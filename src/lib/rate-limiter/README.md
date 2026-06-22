# Rate Limiter

**Task 8.8**: Basic endpoint rate limiting to prevent abuse

This module provides in-memory rate limiting using a sliding window algorithm. It's designed to prevent abuse while maintaining a good user experience.

## Features

- **Sliding Window Algorithm**: More accurate than fixed window, smooths traffic over time
- **Pre-configured Limiters**: Ready-to-use rate limiters for specific endpoints
- **Easy Integration**: Simple middleware function for API routes
- **Memory Efficient**: Automatic cleanup of old records
- **Standard Headers**: Includes `Retry-After`, `X-RateLimit-*` headers

## Usage

### Basic Usage

```typescript
import { courseSearchSessionLimiter, applyRateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  // Get user ID from authentication
  const { user } = await supabase.auth.getUser();
  
  // Apply rate limiting
  const rateLimitResponse = applyRateLimit(
    courseSearchSessionLimiter,
    user.id,
    'course search'
  );
  if (rateLimitResponse) return rateLimitResponse;
  
  // Continue with normal request processing
  // ...
}
```

### Pre-configured Limiters

#### `courseSearchSessionLimiter`
- **Endpoint**: `POST /api/course-search-sessions`
- **Limit**: 10 requests per minute per user
- **Use Case**: Prevents rapid-fire course searches

```typescript
import { courseSearchSessionLimiter, applyRateLimit } from '@/lib/rate-limiter';

const rateLimitResponse = applyRateLimit(
  courseSearchSessionLimiter,
  userId,
  'course search'
);
if (rateLimitResponse) return rateLimitResponse;
```

#### `applyShortlistLimiter`
- **Endpoint**: `POST /api/apply-shortlist/add-courses`
- **Limit**: 5 requests per minute per user
- **Use Case**: Prevents rapid course addition spam

```typescript
import { applyShortlistLimiter, applyRateLimit } from '@/lib/rate-limiter';

const rateLimitResponse = applyRateLimit(
  applyShortlistLimiter,
  userId,
  'course addition'
);
if (rateLimitResponse) return rateLimitResponse;
```

### Custom Rate Limiter

```typescript
import { RateLimiter } from '@/lib/rate-limiter';

const customLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000, // 1 minute
});

const result = customLimiter.checkLimit(userId);
if (!result.allowed) {
  return NextResponse.json(
    { 
      error: 'Too many requests',
      retryAfter: result.retryAfter 
    },
    { status: 429 }
  );
}
```

## Response Format

When rate limit is exceeded, a 429 response is returned:

```json
{
  "error": "Too Many Requests",
  "message": "You've made too many course search attempts. Please wait 45 seconds before trying again.",
  "retryAfter": 45,
  "limit": 10,
  "resetAt": 1704067200000
}
```

### Response Headers

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
```

## Architecture

### Sliding Window Algorithm

The rate limiter uses a sliding window algorithm:

1. Each request is timestamped and stored
2. When checking a new request, old requests outside the time window are filtered out
3. If remaining requests < limit, the request is allowed
4. The window "slides" forward with each request

**Example** (10 requests/minute):
```
Time: 0s  -> Request 1-10 (allowed)
Time: 30s -> Request 11 (rejected, 10 requests in last 60s)
Time: 61s -> Request 12 (allowed, request 1 is now outside window)
```

### Memory Management

- Automatic cleanup runs every 60 seconds
- Old request records are removed to prevent memory leaks
- Identifiers with no recent requests are deleted

### Limitations

⚠️ **In-Memory Storage**: This implementation stores rate limit data in memory. In multi-instance deployments (e.g., Vercel with multiple serverless functions), each instance maintains its own rate limit state, which can allow users to exceed limits by hitting different instances.

**For production multi-instance deployments**, consider:
- **Redis-based rate limiting**: Use `@upstash/ratelimit` or `ioredis`
- **Edge rate limiting**: Use Vercel Edge Config or Cloudflare Workers KV
- **Distributed rate limiting**: Use a shared cache layer

## Configuration

### Adjusting Limits

Edit the pre-configured limiters in `rate-limiter.ts`:

```typescript
export const courseSearchSessionLimiter = new RateLimiter({
  maxRequests: 15, // Changed from 10
  windowMs: 60000, // 1 minute
});
```

### Environment-Based Configuration

For different limits in dev/staging/prod:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

export const courseSearchSessionLimiter = new RateLimiter({
  maxRequests: isDevelopment ? 100 : 10,
  windowMs: 60000,
});
```

## Testing

### Manual Testing

```typescript
import { courseSearchSessionLimiter } from '@/lib/rate-limiter';

// Make 10 requests (all should succeed)
for (let i = 0; i < 10; i++) {
  const result = courseSearchSessionLimiter.checkLimit('test-user-id');
  console.log(`Request ${i + 1}: allowed=${result.allowed}`);
}

// 11th request should be rejected
const result = courseSearchSessionLimiter.checkLimit('test-user-id');
console.log(`Request 11: allowed=${result.allowed}, retryAfter=${result.retryAfter}s`);

// Reset for next test
courseSearchSessionLimiter.reset('test-user-id');
```

### Integration Testing

```typescript
describe('Rate Limiting', () => {
  beforeEach(() => {
    courseSearchSessionLimiter.resetAll();
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await POST(createMockRequest());
      expect(response.status).not.toBe(429);
    }
  });

  it('should block requests exceeding limit', async () => {
    // Make 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      await POST(createMockRequest());
    }
    
    // 11th request should be rate limited
    const response = await POST(createMockRequest());
    expect(response.status).toBe(429);
    
    const body = await response.json();
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
```

## Relationship to Subscription Limits

Rate limiting and subscription-based usage limits serve different purposes:

### Rate Limiting (This Module)
- **Purpose**: Prevent abuse and API spam
- **Scope**: Short time windows (per minute)
- **Limit**: 10-20 requests/minute
- **Applies to**: All users (free and paid)
- **Response**: 429 Too Many Requests

### Subscription Limits (Phase 4)
- **Purpose**: Fair-use quota management
- **Scope**: Monthly billing period
- **Limit**: 3 searches/month (free), unlimited (Plus)
- **Applies to**: Based on subscription tier
- **Response**: 403 Forbidden with upgrade prompt

**Both systems work together**:
1. Rate limiting catches rapid-fire abuse (seconds/minutes)
2. Subscription limits enforce fair monthly usage (days/weeks)
3. Rate limits apply BEFORE subscription checks (cheaper to compute)

## Migration to Redis

When scaling to multiple instances, migrate to Redis:

```typescript
// redis-rate-limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const courseSearchSessionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:course-search',
});

// Usage remains the same
const { success, limit, reset, remaining } = await courseSearchSessionLimiter.limit(userId);
if (!success) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429 }
  );
}
```

## API Reference

### `RateLimiter`

```typescript
class RateLimiter {
  constructor(config: RateLimitConfig);
  checkLimit(identifier: string): RateLimitResult;
  getRequestCount(identifier: string): number;
  reset(identifier: string): void;
  resetAll(): void;
  destroy(): void;
}
```

### `applyRateLimit()`

```typescript
function applyRateLimit(
  limiter: RateLimiter,
  identifier: string,
  limitName?: string
): NextResponse | null;
```

Returns `null` if allowed, or a 429 response if rate limit exceeded.

### Types

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitErrorResponse {
  error: string;
  message: string;
  retryAfter: number;
  limit: number;
  resetAt: number;
}
```

## Troubleshooting

### Issue: Users can exceed limits

**Cause**: Multi-instance deployment with in-memory storage

**Solution**: Migrate to Redis-based rate limiting (see "Migration to Redis" section)

### Issue: Rate limits too strict

**Cause**: Misconfigured `maxRequests` or `windowMs`

**Solution**: Adjust limits in `rate-limiter.ts` based on usage patterns

### Issue: Memory growing over time

**Cause**: Cleanup not running (unlikely but possible)

**Solution**: Check cleanup interval, manually call `.destroy()` if needed

## Performance

- **Check Limit**: O(n) where n = requests in current window (typically < 20)
- **Memory**: ~50-100 bytes per request record
- **Cleanup**: Runs every 60 seconds, O(n) where n = total identifiers

**Estimated memory usage**:
- 1,000 users with 10 requests/min = ~1MB
- 10,000 users with 10 requests/min = ~10MB
- 100,000 users with 10 requests/min = ~100MB

For high-traffic scenarios (>10k concurrent users), use Redis.
