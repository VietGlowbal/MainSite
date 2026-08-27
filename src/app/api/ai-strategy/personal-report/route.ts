import { NextResponse } from 'next/server';
import { z } from 'zod';
import { regeneratePersonalReport } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, personalReportLimiter } from '@/lib/rate-limiter';

/**
 * Canonical Personal Report generation. When an applicationId is supplied,
 * generation is pinned to that application's confirmed snapshot.
 *
 * The actual decision logic (regenerate or return the cached latest
 * version) lives in `regeneratePersonalReport`
 * (`src/features/apply/api/personal-report-generation.ts`), shared with the
 * Matching Report route so both can trigger a Personal Report refresh. See
 * that module's doc comment for why there is no time-based cooldown here.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  applicationId: z.string().trim().min(1).max(200).optional(),
  trigger: z.enum(['manual', 'matching_report', 'supplement_answer']).optional(),
  force: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const rawBody = await request.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
  const body = parsedBody.data;
  if (!body.applicationId) {
    return NextResponse.json(
      { error: 'An applicationId is required for Personal Report generation.', code: 'APPLICATION_REQUIRED' },
      { status: 422 },
    );
  }

  const limited = applyRateLimit(personalReportLimiter, `${user.id}:${body.applicationId}`, 'Personal Report');
  if (limited) return limited;

  const result = await regeneratePersonalReport({
    supabase,
    userId: user.id,
    trigger: body.trigger ?? 'manual',
    applicationId: body.applicationId,
    ...(body.force !== undefined ? { force: body.force } : {}),
    ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
  });

  switch (result.status) {
    case 'snapshot_missing':
      return NextResponse.json(
        { error: 'Confirm Candidate Information for an application before generating a Personal Report.' },
        { status: 409 },
      );
    case 'migration_missing':
      return NextResponse.json(
        { error: 'This feature is not enabled in this environment.' },
        { status: 503 },
      );
    case 'not_configured':
      return NextResponse.json(
        { error: 'The AI service is not configured. Missing OPENAI_API_KEY.' },
        { status: 503 },
      );
    case 'insufficient_evidence':
      return NextResponse.json(
        { error: 'Add reflections, activities, or achievements before generating a Personal Report.' },
        { status: 422 },
      );
    case 'error':
      return NextResponse.json(
        {
          error: result.message,
          ...(result.record ? { reportV2: result.record.reportV2 } : {}),
        },
        { status: 502 },
      );
    case 'cached':
      return NextResponse.json({
        reportV2: result.record.reportV2,
        cached: true,
        versionId: result.record.id,
        generatedAt: result.record.generatedAt,
      });
    case 'regenerated':
      return NextResponse.json({
        reportV2: result.record.reportV2,
        cached: false,
        versionId: result.record.id,
        generatedAt: result.record.generatedAt,
      });
  }
}
