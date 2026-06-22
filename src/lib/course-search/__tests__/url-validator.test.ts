/**
 * Tests for URL Validator (Task 13.5)
 * 
 * Tests the validateCourseUrl and batchValidateCourseUrls functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateCourseUrl, batchValidateCourseUrls } from '../url-validator';

// Mock fetch globally
global.fetch = vi.fn();

describe('validateCourseUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL format validation', () => {
    it('should reject invalid URL format', async () => {
      const result = await validateCourseUrl('not-a-valid-url', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid URL format');
    });

    it('should accept valid URL format', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/computer-science', 'ox.ac.uk');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Non-course page detection', () => {
    it('should reject PDF files', async () => {
      const result = await validateCourseUrl('https://www.ox.ac.uk/files/course-catalog.pdf', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('pdf');
    });

    it('should reject news pages', async () => {
      const result = await validateCourseUrl('https://www.ox.ac.uk/news/latest-updates', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('news');
    });

    it('should reject blog pages', async () => {
      const result = await validateCourseUrl('https://www.ox.ac.uk/blog/student-life', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('blog');
    });

    it('should reject directory listings', async () => {
      const result = await validateCourseUrl('https://www.ox.ac.uk/directory/departments', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('directory');
    });

    it('should reject staff pages', async () => {
      const result = await validateCourseUrl('https://www.ox.ac.uk/staff/professors', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('staff');
    });
  });

  describe('Domain validation', () => {
    it('should reject URL from wrong domain', async () => {
      const result = await validateCourseUrl('https://www.stanford.edu/courses/cs101', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match expected university domain');
    });

    it('should reject URL from domain that ends with expected domain but is not a subdomain', async () => {
      // Edge case: 'notox.ac.uk' should NOT match 'ox.ac.uk'
      const result = await validateCourseUrl('https://notox.ac.uk/courses/cs', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match expected university domain');
    });

    it('should accept URL with subdomain matching expected domain', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/cs', 'ox.ac.uk');
      
      expect(result.isValid).toBe(true);
    });

    it('should accept URL with exact domain match', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateCourseUrl('https://ox.ac.uk/courses/cs', 'ox.ac.uk');
      
      expect(result.isValid).toBe(true);
    });

    it('should skip domain validation when expectedDomain is null', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateCourseUrl('https://www.stanford.edu/courses/cs', null);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('URL accessibility check', () => {
    it('should accept URL with 200 OK status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/cs', 'ox.ac.uk');
      
      expect(result.isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.ox.ac.uk/courses/cs',
        expect.objectContaining({
          method: 'HEAD',
          redirect: 'manual',
        })
      );
    });

    it('should accept URL with redirect status (3xx)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 301,
      });

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/cs', 'ox.ac.uk');
      
      expect(result.isValid).toBe(true);
    });

    it('should reject URL with 404 status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/nonexistent', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('HTTP status 404');
    });

    it('should reject URL that times out', async () => {
      // Mock a timeout by rejecting with AbortError
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      (global.fetch as any).mockRejectedValueOnce(abortError);

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/slow', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('timed out');
    });

    it('should reject URL with network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await validateCourseUrl('https://www.ox.ac.uk/courses/unavailable', 'ox.ac.uk');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not accessible');
    });
  });
});

describe('batchValidateCourseUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should separate valid and invalid courses', async () => {
    const courses = [
      { course_name: 'Computer Science', course_url: 'https://www.ox.ac.uk/courses/cs' },
      { course_name: 'Math PDF', course_url: 'https://www.ox.ac.uk/files/math.pdf' },
      { course_name: 'Physics', course_url: 'https://www.ox.ac.uk/courses/physics' },
      { course_name: 'Wrong Domain', course_url: 'https://www.stanford.edu/courses/bio' },
    ];

    // Mock successful responses for valid courses
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200 }) // CS
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Physics

    const result = await batchValidateCourseUrls(courses, 'ox.ac.uk');

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].course_name).toBe('Computer Science');
    expect(result.valid[1].course_name).toBe('Physics');

    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].course.course_name).toBe('Math PDF');
    expect(result.invalid[0].reason).toContain('pdf');
    expect(result.invalid[1].course.course_name).toBe('Wrong Domain');
    expect(result.invalid[1].reason).toContain('does not match');
  });

  it('should handle all valid courses', async () => {
    const courses = [
      { course_name: 'Computer Science', course_url: 'https://www.ox.ac.uk/courses/cs' },
      { course_name: 'Physics', course_url: 'https://www.ox.ac.uk/courses/physics' },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await batchValidateCourseUrls(courses, 'ox.ac.uk');

    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  it('should handle all invalid courses', async () => {
    const courses = [
      { course_name: 'PDF File', course_url: 'https://www.ox.ac.uk/files/course.pdf' },
      { course_name: 'News Page', course_url: 'https://www.ox.ac.uk/news/updates' },
    ];

    const result = await batchValidateCourseUrls(courses, 'ox.ac.uk');

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });

  it('should handle empty course array', async () => {
    const result = await batchValidateCourseUrls([], 'ox.ac.uk');

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });
});
