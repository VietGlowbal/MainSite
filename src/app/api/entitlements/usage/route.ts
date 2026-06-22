/**
 * GET /api/entitlements/usage - Get current user's usage information
 * 
 * Task 20.3: Add usage indicators throughout UI
 * 
 * Returns current usage stats for display in UI components.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserEntitlement } from '@/lib/entitlements/entitlement-service';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // 2. Get user entitlement with current usage
    const usage = await getUserEntitlement(user.id);
    
    // 3. Return usage information
    return NextResponse.json({
      plan: usage.plan,
      courseSearchLimit: usage.courseSearchLimit,
      courseSearchesUsed: usage.courseSearchesUsed,
      courseAddLimit: usage.courseAddLimit,
      coursesAdded: usage.coursesAdded,
    });
    
  } catch (error) {
    console.error('Error in /api/entitlements/usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
