/**
 * Tests for Rate Limiter
 * 
 * Task 8.8: Basic endpoint rate limiting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000, // 1 minute
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const identifier = 'user-1';

      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit(identifier);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10 - i - 1);
      }
    });

    it('should block requests exceeding limit', () => {
      const identifier = 'user-1';

      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(identifier);
      }

      // 11th request should be blocked
      const result = limiter.checkLimit(identifier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should provide retry information when blocked', () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(identifier);
      }

      // Check retry info
      const result = limiter.checkLimit(identifier);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Sliding Window', () => {
    it('should allow requests after window slides', async () => {
      const identifier = 'user-1';
      const limiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 100, // 100ms window for faster test
      });

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        const result = limiter.checkLimit(identifier);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked
      const blocked = limiter.checkLimit(identifier);
      expect(blocked.allowed).toBe(false);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const allowed = limiter.checkLimit(identifier);
      expect(allowed.allowed).toBe(true);

      limiter.destroy();
    });

    it('should correctly filter old requests', async () => {
      const identifier = 'user-1';
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 100,
      });

      // Make 3 requests
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);

      // Wait for half the window
      await new Promise(resolve => setTimeout(resolve, 60));

      // Make 2 more requests (total 5, at limit)
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);

      // Should be blocked
      expect(limiter.checkLimit(identifier).allowed).toBe(false);

      // Wait for first 3 requests to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should allow new requests (first 3 expired)
      expect(limiter.checkLimit(identifier).allowed).toBe(true);

      limiter.destroy();
    });
  });

  describe('Multiple Identifiers', () => {
    it('should track requests independently per identifier', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // User 1 makes 10 requests
      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit(user1);
        expect(result.allowed).toBe(true);
      }

      // User 1 is now rate limited
      expect(limiter.checkLimit(user1).allowed).toBe(false);

      // User 2 should still be able to make requests
      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit(user2);
        expect(result.allowed).toBe(true);
      }
    });

    it('should not leak limits between identifiers', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(user1);
      }

      // User 2 should start from 0, not 5
      const result = limiter.checkLimit(user2);
      expect(result.remaining).toBe(9); // 10 - 1 = 9
    });
  });

  describe('Reset Functionality', () => {
    it('should reset limits for a specific identifier', () => {
      const identifier = 'user-1';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit(identifier);
      }

      // Should be blocked
      expect(limiter.checkLimit(identifier).allowed).toBe(false);

      // Reset
      limiter.reset(identifier);

      // Should be allowed again
      const result = limiter.checkLimit(identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should reset all identifiers', () => {
      // Exhaust limits for multiple users
      for (let i = 1; i <= 3; i++) {
        const identifier = `user-${i}`;
        for (let j = 0; j < 10; j++) {
          limiter.checkLimit(identifier);
        }
        expect(limiter.checkLimit(identifier).allowed).toBe(false);
      }

      // Reset all
      limiter.resetAll();

      // All should be allowed again
      for (let i = 1; i <= 3; i++) {
        const identifier = `user-${i}`;
        const result = limiter.checkLimit(identifier);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Request Count', () => {
    it('should return correct request count', () => {
      const identifier = 'user-1';

      expect(limiter.getRequestCount(identifier)).toBe(0);

      limiter.checkLimit(identifier);
      expect(limiter.getRequestCount(identifier)).toBe(1);

      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);
      expect(limiter.getRequestCount(identifier)).toBe(3);
    });

    it('should return 0 for unknown identifier', () => {
      expect(limiter.getRequestCount('unknown-user')).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should remove old request records', async () => {
      const identifier = 'user-1';
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 100, // Short window for test
      });

      // Make some requests
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);
      expect(limiter.getRequestCount(identifier)).toBe(2);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup by making a new request
      limiter.checkLimit(identifier);

      // Old requests should be cleaned up
      // We should only have 1 request (the new one)
      expect(limiter.getRequestCount(identifier)).toBe(1);

      limiter.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty identifier', () => {
      const result = limiter.checkLimit('');
      expect(result.allowed).toBe(true);
    });

    it('should handle very long identifier', () => {
      const longId = 'a'.repeat(1000);
      const result = limiter.checkLimit(longId);
      expect(result.allowed).toBe(true);
    });

    it('should handle rapid successive requests', () => {
      const identifier = 'user-1';
      const results = [];

      // Make 15 rapid requests
      for (let i = 0; i < 15; i++) {
        results.push(limiter.checkLimit(identifier));
      }

      // First 10 should be allowed
      expect(results.slice(0, 10).every(r => r.allowed)).toBe(true);
      
      // Last 5 should be blocked
      expect(results.slice(10).every(r => !r.allowed)).toBe(true);
    });

    it('should handle max requests of 1', () => {
      const limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60000,
      });

      const identifier = 'user-1';

      // First request allowed
      expect(limiter.checkLimit(identifier).allowed).toBe(true);

      // Second request blocked
      expect(limiter.checkLimit(identifier).allowed).toBe(false);

      limiter.destroy();
    });
  });

  describe('Configuration', () => {
    it('should respect custom max requests', () => {
      const limiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 60000,
      });

      const identifier = 'user-1';

      // Should allow 3 requests
      expect(limiter.checkLimit(identifier).allowed).toBe(true);
      expect(limiter.checkLimit(identifier).allowed).toBe(true);
      expect(limiter.checkLimit(identifier).allowed).toBe(true);

      // 4th should be blocked
      expect(limiter.checkLimit(identifier).allowed).toBe(false);

      limiter.destroy();
    });

    it('should respect custom window', async () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 50, // 50ms
      });

      const identifier = 'user-1';

      // Use up limit
      limiter.checkLimit(identifier);
      limiter.checkLimit(identifier);
      expect(limiter.checkLimit(identifier).allowed).toBe(false);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should be allowed again
      expect(limiter.checkLimit(identifier).allowed).toBe(true);

      limiter.destroy();
    });
  });

  describe('Metadata', () => {
    it('should provide correct remaining count', () => {
      const identifier = 'user-1';

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(limiter.checkLimit(identifier));
      }

      // Check remaining counts
      expect(results[0].remaining).toBe(9);
      expect(results[5].remaining).toBe(4);
      expect(results[9].remaining).toBe(0);
    });

    it('should provide reset timestamp', () => {
      const identifier = 'user-1';
      const before = Date.now();
      
      const result = limiter.checkLimit(identifier);
      
      const after = Date.now() + 60000;
      
      expect(result.resetAt).toBeGreaterThanOrEqual(before);
      expect(result.resetAt).toBeLessThanOrEqual(after);
    });
  });
});
