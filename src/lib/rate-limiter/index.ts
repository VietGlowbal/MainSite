/**
 * Rate Limiter Module
 * 
 * Task 8.8: Basic endpoint rate limiting to prevent abuse
 * 
 * This module provides in-memory rate limiting using sliding window algorithm.
 * Pre-configured limiters are available for specific endpoints.
 * 
 * @example Basic usage
 * ```ts
 * import { courseSearchSessionLimiter, applyRateLimit } from '@/lib/rate-limiter';
 * 
 * const rateLimitResponse = applyRateLimit(
 *   courseSearchSessionLimiter,
 *   userId,
 *   'course search'
 * );
 * if (rateLimitResponse) return rateLimitResponse;
 * ```
 */

export {
  RateLimiter,
  courseSearchSessionLimiter,
  applyShortlistLimiter,
  lorAiLimiter,
  passwordResetLimiter,
  personalReportLimiter,
  strategyAiLimiter,
  strategyExportLimiter,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter';

export {
  applyRateLimit,
  addRateLimitHeaders,
  type RateLimitErrorResponse,
} from './middleware';
