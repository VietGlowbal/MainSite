/**
 * Unit tests for course-search-sessions route helper functions
 * Tests URL normalization and deduplication logic
 */

import { describe, it, expect } from 'vitest';

// Helper: Normalize URL for deduplication
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Lowercase the host
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Normalize path (remove trailing slash if not root)
    let path = urlObj.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    urlObj.pathname = path;
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url.toLowerCase().trim();
  }
}

// Helper: Deduplicate results by normalized URL
function deduplicateResultsByUrl(results: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const result of results) {
    const normalized = normalizeUrl(result.courseUrl);
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }
  
  return unique;
}

// Helper: Convert confidence score to label
type ConfidenceLabel = 'Checked recently' | 'Good match' | 'Needs review' | 'Needs refresh';

function getConfidenceLabelFromScore(score: number): ConfidenceLabel {
  if (score >= 0.9) {
    return 'Checked recently';
  } else if (score >= 0.7) {
    return 'Good match';
  } else {
    return 'Needs review';
  }
}

describe('course-search-sessions helpers', () => {
  describe('normalizeUrl', () => {
    it('should remove trailing slash from non-root paths', () => {
      const result = normalizeUrl('https://example.com/courses/');
      expect(result).toBe('https://example.com/courses');
    });

    it('should keep trailing slash for root path', () => {
      const result = normalizeUrl('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('should remove tracking parameters', () => {
      const result = normalizeUrl('https://example.com/course?utm_source=google&fbclid=123&gclid=456');
      expect(result).toBe('https://example.com/course');
    });

    it('should lowercase hostname', () => {
      const result = normalizeUrl('https://Example.COM/courses');
      expect(result).toBe('https://example.com/courses');
    });

    it('should handle URLs with query parameters', () => {
      const result = normalizeUrl('https://example.com/course?id=123&utm_source=test');
      expect(result).toBe('https://example.com/course?id=123');
    });

    it('should handle invalid URLs gracefully', () => {
      const result = normalizeUrl('not a valid url');
      expect(result).toBe('not a valid url');
    });
  });

  describe('deduplicateResultsByUrl', () => {
    it('should remove duplicate URLs with different tracking params', () => {
      const results = [
        { courseUrl: 'https://example.com/course?utm_source=google', courseName: 'Course 1' },
        { courseUrl: 'https://example.com/course', courseName: 'Course 2' },
      ];
      
      const unique = deduplicateResultsByUrl(results);
      expect(unique).toHaveLength(1);
      expect(unique[0].courseName).toBe('Course 1'); // Keeps first occurrence
    });

    it('should remove duplicate URLs with trailing slash differences', () => {
      const results = [
        { courseUrl: 'https://example.com/course/', courseName: 'Course 1' },
        { courseUrl: 'https://example.com/course', courseName: 'Course 2' },
      ];
      
      const unique = deduplicateResultsByUrl(results);
      expect(unique).toHaveLength(1);
    });

    it('should keep truly unique URLs', () => {
      const results = [
        { courseUrl: 'https://example.com/course1', courseName: 'Course 1' },
        { courseUrl: 'https://example.com/course2', courseName: 'Course 2' },
        { courseUrl: 'https://example.com/course3', courseName: 'Course 3' },
      ];
      
      const unique = deduplicateResultsByUrl(results);
      expect(unique).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const unique = deduplicateResultsByUrl([]);
      expect(unique).toHaveLength(0);
    });
  });

  describe('getConfidenceLabelFromScore', () => {
    it('should return "Checked recently" for scores >= 0.9', () => {
      expect(getConfidenceLabelFromScore(0.9)).toBe('Checked recently');
      expect(getConfidenceLabelFromScore(0.95)).toBe('Checked recently');
      expect(getConfidenceLabelFromScore(1.0)).toBe('Checked recently');
    });

    it('should return "Good match" for scores 0.7-0.89', () => {
      expect(getConfidenceLabelFromScore(0.7)).toBe('Good match');
      expect(getConfidenceLabelFromScore(0.8)).toBe('Good match');
      expect(getConfidenceLabelFromScore(0.89)).toBe('Good match');
    });

    it('should return "Needs review" for scores < 0.7', () => {
      expect(getConfidenceLabelFromScore(0.5)).toBe('Needs review');
      expect(getConfidenceLabelFromScore(0.69)).toBe('Needs review');
      expect(getConfidenceLabelFromScore(0.0)).toBe('Needs review');
    });
  });
});
