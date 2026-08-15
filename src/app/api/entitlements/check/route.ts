import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserEntitlement, canCreateCourseSearchSession } from '@/lib/entitlements/entitlement-service';

/**
 * POST /api/entitlements/check
 * 
 * Check user's entitlement and usage limits
 * Returns entitlement data and whether user can create a search session
 */
export async function POST() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get entitlement data
    const usage = await getUserEntitlement(user.id);
    
    // Check if user can create a new session
    const canCreate = await canCreateCourseSearchSession(user.id);

    return NextResponse.json({
      ...usage,
      canCreateSession: canCreate.allowed,
      upgradeRequired: canCreate.upgradeRequired,
      limitReason: canCreate.reason,
    });
  } catch (error) {
    console.error('Error checking entitlements:', error);
    return NextResponse.json(
      { error: 'Failed to check entitlements' },
      { status: 500 }
    );
  }
}
