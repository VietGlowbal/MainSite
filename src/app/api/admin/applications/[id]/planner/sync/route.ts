import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanPersistenceError, syncApplicationPlanWithTrustedClient } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/server/auth/auth-helpers';
import { sameOrigin } from '@/server/payments/manual-review-auth';

export const runtime = 'nodejs';

const applicationIdSchema = z.string().uuid();

/**
 * Production bootstrap for admins demonstrating their own application plan.
 * `syncApplicationPlan` retains its ownership check, so admin status cannot
 * be used to create or alter another student's plan.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });

  const { id } = await context.params;
  const parsedApplicationId = applicationIdSchema.safeParse(id);
  if (!parsedApplicationId.success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await syncApplicationPlanWithTrustedClient(parsedApplicationId.data, user.id);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof PlanPersistenceError && error.message === 'Application was not found for this user.') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    console.error('[admin/planner/sync] canonical plan generation failed', error);
    return NextResponse.json({ error: 'Could not generate the canonical plan' }, { status: 500 });
  }
}
