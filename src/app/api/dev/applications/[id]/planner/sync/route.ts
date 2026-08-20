import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanPersistenceError, syncApplicationPlan } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const applicationIdSchema = z.string().uuid();

/**
 * Local-demo bootstrap only. It deliberately does not exist in a production
 * deployment, so canonical-plan generation cannot become a public write path.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });

  const { id } = await context.params;
  const parsedApplicationId = applicationIdSchema.safeParse(id);
  if (!parsedApplicationId.success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await syncApplicationPlan(supabase, parsedApplicationId.data, user.id);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof PlanPersistenceError && error.message === 'Application was not found for this user.') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    console.error('[dev/planner/sync] canonical plan generation failed', error);
    return NextResponse.json({ error: 'Could not generate the canonical plan' }, { status: 500 });
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
