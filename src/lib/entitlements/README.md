# Entitlement Service

Enforces usage limits for AI Course Search and Apply features in GlowBal.

## Overview

The entitlement service manages subscription tiers and enforces usage quotas:

- **Free tier**: 3 AI course searches per month + 5 active course applications
- **Plus tier**: Unlimited searches and applications (999,999 limit)

## Quick Start

```typescript
import { canCreateCourseSearchSession } from '@/lib/entitlements/entitlement-service';

// Check if user can create a new search session
const check = await canCreateCourseSearchSession(userId);

if (!check.allowed) {
  // User has exceeded their quota
  console.log(check.reason); // User-friendly error message
  console.log(check.upgradeRequired); // true for free users
  console.log(check.usage); // Current usage stats
}
```

## API Reference

### `canCreateCourseSearchSession(userId: string)`

Checks if a user can create a new course search session.

**Returns:** `EntitlementCheckResult`
- `allowed: boolean` - Whether the user can proceed
- `usage?: UserEntitlement` - Current usage statistics
- `upgradeRequired?: boolean` - Whether upgrade is needed (free users only)
- `reason?: string` - User-friendly error message if not allowed

**Usage Counting:**
- Only sessions with `status = 'complete'` count toward quota
- Resets monthly on the 1st of each month
- Failed/timeout sessions do NOT count (fair-use protection)

### `canAddCoursesToApply(userId: string, selectedCount?: number)`

Checks if a user can add courses to their Apply shortlist.

**Parameters:**
- `userId` - The user ID to check
- `selectedCount` - Number of courses to add (default: 1)

**Returns:** `EntitlementCheckResult`

**Usage Counting:**
- Counts active applications where `status != 'archived'`
- Free users limited to 5 active courses
- Plus users have unlimited (999,999)

### `getUserEntitlement(userId: string)`

Fetches user's plan tier, limits, and current usage.

**Returns:** `UserEntitlement`
```typescript
{
  plan: 'free' | 'plus' | 'team' | 'admin',
  courseSearchLimit: number,      // Monthly search limit
  courseSearchesUsed: number,     // Searches this month
  courseAddLimit: number,          // Max active courses
  coursesAdded: number            // Current active courses
}
```

### `hasActiveGlowBalSubscription(userId: string)`

Checks if user has an active Plus subscription.

**Returns:** `boolean` - True if `student_profiles.plus_status = true`

### `formatRemainingUsage(limit: number, used: number)`

Formats remaining usage for display. Shows "Unlimited" for 999,999 limit.

### `getPlanLimits(plan: PlanTier)`

Returns default limits for a given plan tier.

## TypeScript Types

```typescript
export type PlanTier = 'free' | 'plus' | 'team' | 'admin';

export interface UserEntitlement {
  plan: PlanTier;
  courseSearchLimit: number;
  courseSearchesUsed: number;
  courseAddLimit: number;
  coursesAdded: number;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  usage?: UserEntitlement;
  upgradeRequired?: boolean;
  reason?: string;
}
```

## Database Dependencies

### Tables Required
- `student_profiles` - Stores `plus_status` for subscription tier
- `course_search_sessions` - Tracks search usage (counts `status = 'complete'`)
- `course_applications` - Tracks active courses (counts `status != 'archived'`)

### Indexes
Ensure these indexes exist for performance:
- `course_search_sessions(user_id, status, created_at)`
- `course_applications(user_id, status)`

## Usage Examples

### API Route Usage
```typescript
// In an API route
const check = await canCreateCourseSearchSession(user.id);

if (!check.allowed) {
  return NextResponse.json(
    {
      allowed: false,
      usage: check.usage,
      upgradeRequired: check.upgradeRequired,
      error: check.reason,
    },
    { status: 403 }
  );
}
```

### Frontend Usage
```typescript
// Handle 403 response
const response = await fetch('/api/course-search-sessions', {
  method: 'POST',
  body: JSON.stringify({ universityId, query })
});

if (response.status === 403) {
  const data = await response.json();
  
  if (data.upgradeRequired) {
    showUpgradeModal({
      message: data.error,
      usage: data.usage
    });
  }
}
```

### Display Usage Stats
```typescript
import { getUserEntitlement, formatRemainingUsage } from '@/lib/entitlements/entitlement-service';

const usage = await getUserEntitlement(userId);

const remaining = formatRemainingUsage(
  usage.courseSearchLimit,
  usage.courseSearchesUsed
);

console.log(`Searches remaining: ${remaining}`);
// Free user: "Searches remaining: 2"
// Plus user: "Searches remaining: Unlimited"
```

## Plan Limits

| Feature | Free | Plus |
|---------|------|------|
| Course searches per month | 3 | Unlimited |
| Active course applications | 5 | Unlimited |
| Failed searches counted | No | No |
| Monthly reset | 1st of month | N/A |

## Fair-Use Protection

The system implements several fair-use protections:

1. **Only complete searches count** - Sessions stuck in 'processing' or marked 'failed' don't count
2. **Timeout protection** - Sessions that timeout don't count toward quota
3. **Monthly reset** - Free users get fresh quota each month
4. **Clear communication** - User-friendly error messages with upgrade prompts

## Testing

See `TASK_8.2_COMPLETE.md` for detailed testing instructions and database queries.

## Integration Notes

- Service uses `student_profiles.plus_status` to determine subscription tier
- No separate `user_entitlements` table required at this stage
- Can be extended later to support time-based subscriptions, team plans, etc.
- All database queries use service role credentials (called from API routes)

## Error Handling

All functions handle database errors gracefully:
- Database errors are logged to console
- Usage counts default to 0 if queries fail
- Entitlement checks fail open (allow access) if subscription status can't be determined

## Future Enhancements

Potential extensions for this service:
- Time-based subscriptions (plus_expires_at checking)
- Team/organization quotas
- Admin overrides
- Usage analytics
- Rate limiting by time window (hourly, daily)
- Separate entitlements table with billing periods
