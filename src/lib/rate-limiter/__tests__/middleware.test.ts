/**
 * Tests for Rate Limiting Middleware
 * 
 * Task 8.8: Basic endpoint rate limiting middleware
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import { RateLimiter } from '../rate-limiter';
import { applyRateLimit, addRateLimitHeaders } from '../middleware';

describe('Rate Limiting Middleware', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('applyRateLimit()', () => {
    it('should return null when request is allowed', () => {
      const result = applyRateLimit(limiter, 'user-1', 'test');
      expect(result).toBeNull();
    });

    it('should return 429 response when limit exceeded', () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, identifier, 'test');
      }

      // Next request should be rate limited
      const response = applyRateLimit(limiter, identifier, 'test');
      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);
    });

    it('should include error details in response body', async () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, identifier, 'test requests');
      }

      const response = applyRateLimit(limiter, identifier, 'test requests');
      const body = await response?.json();

      expect(body).toMatchObject({
        error: 'Too Many Requests',
        message: expect.stringContaining('test requests'),
        retryAfter: expect.any(Number),
        limit: 5,
        resetAt: expect.any(Number),
      });
    });

    it('should include Retry-After header', () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, identifier, 'test');
      }

      const response = applyRateLimit(limiter, identifier, 'test');
      const retryAfter = response?.headers.get('Retry-After');
      
      expect(retryAfter).toBeDefined();
      expect(parseInt(retryAfter!)).toBeGreaterThan(0);
    });

    it('should include X-RateLimit headers', () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, identifier, 'test');
      }

      const response = applyRateLimit(limiter, identifier, 'test');
      
      expect(response?.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response?.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should use custom limit name in message', async () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, identifier, 'course search');
      }

      const response = applyRateLimit(limiter, identifier, 'course search');
      const body = await response?.json();

      expect(body.message).toContain('course search');
    });

    it('should handle different identifiers independently', () => {
      // User 1 exhausts limit
      for (let i = 0; i < 5; i++) {
        applyRateLimit(limiter, 'user-1', 'test');
      }

      // User 1 is blocked
      expect(applyRateLimit(limiter, 'user-1', 'test')).not.toBeNull();

      // User 2 should still be allowed
      expect(applyRateLimit(limiter, 'user-2', 'test')).toBeNull();
    });
  });

  describe('addRateLimitHeaders()', () => {
    it('should add rate limit headers to response', () => {
      const identifier = 'user-1';
      const result = limiter.checkLimit(identifier);
      
      const response = NextResponse.json({ success: true });
      const enhanced = addRateLimitHeaders(response, result, limiter);

      expect(enhanced.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(enhanced.headers.get('X-RateLimit-Remaining')).toBe('4');
      expect(enhanced.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should show correct remaining count', () => {
      const identifier = 'user-1';

      // Make 3 requests
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);
      const result = limiter.checkLimit(identifier);

      const response = NextResponse.json({ success: true });
      const enhanced = addRateLimitHeaders(response, result, limiter);

      expect(enhanced.headers.get('X-RateLimit-Remaining')).toBe('2');
    });

    it('should include Unix timestamp for reset', () => {
      const identifier = 'user-1';
      const result = limiter.checkLimit(identifier);
      
      const response = NextResponse.json({ success: true });
      const enhanced = addRateLimitHeaders(response, result, limiter);

      const resetTimestamp = parseInt(enhanced.headers.get('X-RateLimit-Reset')!);
      const now = Math.floor(Date.now() / 1000);
      
      // Reset should be in the future
      expect(resetTimestamp).toBeGreaterThan(now);
      
      // Reset should be within 60 seconds (our window)
      expect(resetTimestamp).toBeLessThanOrEqual(now + 60);
    });
  });

  describe('Integration', () => {
    it('should work with real API route pattern', async () => {
      const identifier = 'user-1';

      // Simulate API route with rate limiting
      const handleRequest = () => {
        const rateLimitResponse = applyRateLimit(
          limiter,
          identifier,
          'API request'
        );
        
        if (rateLimitResponse) return rateLimitResponse;

        // If rate limit passes, return success response
        const response = NextResponse.json({ data: 'success' });
        return response;
      };

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        const response = handleRequest();
        expect(response.status).not.toBe(429);
      }

      // 6th request should be rate limited
      const blockedResponse = handleRequest();
      expect(blockedResponse.status).toBe(429);
    });
  });
});
