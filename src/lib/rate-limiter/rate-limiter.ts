/**
 * Rate Limiter Implementation
 * 
 * Task 8.8: Basic endpoint rate limiting to prevent abuse
 * 
 * This is an in-memory rate limiter using sliding window algorithm.
 * For production with multiple server instances, consider replacing with Redis-based rate limiting.
 * 
 * Usage:
 * ```ts
 * const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
 * const result = limiter.checkLimit(userId);
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests', retryAfter: result.retryAfter },
 *     { status: 429 }
 *   );
 * }
 * ```
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Timestamp when the rate limit will reset (ms since epoch) */
  resetAt: number;
  /** Seconds until the rate limit resets (only when allowed=false) */
  retryAfter?: number;
}

interface RequestRecord {
  timestamp: number;
}

/**
 * In-memory rate limiter using sliding window algorithm
 * 
 * Thread-safe for single Node.js instance. For multi-instance deployments,
 * use Redis-based rate limiting (e.g., upstash/ratelimit or ioredis).
 */
export class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Start periodic cleanup to prevent memory leaks
    // Clean up old records every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request is allowed for the given identifier
   * 
   * @param identifier - Unique identifier for the requester (e.g., userId, IP address)
   * @returns RateLimitResult with allowed status and metadata
   */
  checkLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this identifier
    let userRequests = this.requests.get(identifier) || [];
    
    // Filter out requests outside the current window (sliding window)
    userRequests = userRequests.filter(req => req.timestamp > windowStart);
    
    // Check if limit is exceeded
    if (userRequests.length >= this.config.maxRequests) {
      // Find the oldest request in the window
      const oldestRequest = userRequests[0];
      const resetAt = oldestRequest.timestamp + this.config.windowMs;
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }
    
    // Allow the request and record it
    userRequests.push({ timestamp: now });
    this.requests.set(identifier, userRequests);
    
    const remaining = this.config.maxRequests - userRequests.length;
    const resetAt = now + this.config.windowMs;
    
    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Clean up old request records to prevent memory leaks
   * Removes records older than the configured window
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    for (const [identifier, requests] of this.requests.entries()) {
      // Filter out old requests
      const validRequests = requests.filter(req => req.timestamp > windowStart);
      
      if (validRequests.length === 0) {
        // No valid requests, remove the identifier
        this.requests.delete(identifier);
      } else {
        // Update with only valid requests
        this.requests.set(identifier, validRequests);
      }
    }
  }

  /**
   * Get current request count for an identifier (for debugging/testing)
   */
  getRequestCount(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const userRequests = this.requests.get(identifier) || [];
    return userRequests.filter(req => req.timestamp > windowStart).length;
  }

  /**
   * Reset rate limit for a specific identifier (for testing)
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Reset all rate limits (for testing)
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}

/**
 * Singleton rate limiter instances for different endpoints
 * 
 * These are initialized once and reused across requests.
 * In serverless environments, these may be re-initialized on cold starts.
 */

/** Rate limiter for POST /api/course-search-sessions - max 10 requests/minute per user */
export const courseSearchSessionLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});

/** Rate limiter for POST /api/apply-shortlist/add-courses - max 5 requests/minute per user */
export const applyShortlistLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 1 minute
});

/** Shared LOR AI budget guard: strategy generation + quality review. */
export const lorAiLimiter = new RateLimiter({
  maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 3,
  windowMs: 60000,
});

/** Shared budget guard for the Application Strategy AI routes added on main. */
export const strategyAiLimiter = new RateLimiter({
  maxRequests: 8,
  windowMs: 60000,
});

/** Personal Report generation budget, per user and application. */
export const personalReportLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
});

/** PDF export guard for Application Strategy. */
export const strategyExportLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
});

/**
 * Password-reset request guard.
 *
 * This endpoint sends an email to any address handed to it, so it is a spam
 * relay if left open, and it is also where an attacker would probe for which
 * addresses hold accounts. Applied twice per request — once per IP and once per
 * target email — so neither "one host, many addresses" nor "many hosts, one
 * victim" gets through. Deliberately tighter than the other limiters: a real
 * person requests a reset once, and twice if the first mail is slow.
 */
export const passwordResetLimiter = new RateLimiter({
  maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});
