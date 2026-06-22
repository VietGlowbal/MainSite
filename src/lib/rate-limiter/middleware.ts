/**
 * Rate Limiting Middleware
 * 
 * Task 8.8: Helper functions to apply rate limiting to API routes
 */

import { NextResponse } from 'next/server';
import type { RateLimiter, RateLimitResult } from './rate-limiter';

export interface RateLimitErrorResponse {
  error: string;
  message: string;
  retryAfter: number;
  limit: number;
  resetAt: number;
}

/**
 * Apply rate limiting to a request
 * 
 * @param limiter - The RateLimiter instance to use
 * @param identifier - Unique identifier for the requester (e.g., userId, IP)
 * @param limitName - Human-readable name for the limit (e.g., "course search")
 * @returns null if allowed, or NextResponse with 429 error if rate limit exceeded
 * 
 * @example
 * ```ts
 * const rateLimitResponse = applyRateLimit(
 *   courseSearchSessionLimiter,
 *   userId,
 *   'course search'
 * );
 * if (rateLimitResponse) return rateLimitResponse;
 * ```
 */
export function applyRateLimit(
  limiter: RateLimiter,
  identifier: string,
  limitName: string = 'requests'
): NextResponse<RateLimitErrorResponse> | null {
  const result = limiter.checkLimit(identifier);
  
  if (!result.allowed) {
    const errorResponse: RateLimitErrorResponse = {
      error: 'Too Many Requests',
      message: `You've made too many ${limitName} attempts. Please wait ${result.retryAfter} seconds before trying again.`,
      retryAfter: result.retryAfter!,
      limit: limiter['config'].maxRequests,
      resetAt: result.resetAt,
    };
    
    return NextResponse.json(errorResponse, {
      status: 429,
      headers: {
        'Retry-After': result.retryAfter!.toString(),
        'X-RateLimit-Limit': limiter['config'].maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
      },
    });
  }
  
  return null;
}

/**
 * Add rate limit headers to a successful response
 * 
 * @param response - The NextResponse to add headers to
 * @param result - The RateLimitResult from checkLimit()
 * @returns The modified response with rate limit headers
 * 
 * @example
 * ```ts
 * const result = limiter.checkLimit(userId);
 * if (!result.allowed) { ... }
 * const response = NextResponse.json(data);
 * return addRateLimitHeaders(response, result);
 * ```
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limiter: RateLimiter
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limiter['config'].maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString());
  
  return response;
}
