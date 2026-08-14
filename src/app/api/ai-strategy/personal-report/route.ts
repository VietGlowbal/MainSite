import { NextResponse } from 'next/server';
import { z } from 'zod';
import { regeneratePersonalReport } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';

/**
 * Canonical user-level Personal Report generation.
 *
 * The actual decision logic (regenerate or return the cached latest
 * version) lives in `regeneratePersonalReport`
 * (`src/features/apply/api/personal-report-generation.ts`), shared with the
 * Matching Report route so both can trigger a Personal Report refresh. See
 * that module's doc comment for why there is no time-based cooldown here.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({ trigger: z.enum(['manual', 'supplement_answer']).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const rawBody = await request.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(rawBody);
  const trigger = parsedBody.success ? (parsedBody.data.trigger ?? 'manual') : 'manual';

  const result = await regeneratePersonalReport({ supabase, userId: user.id, trigger });

  switch (result.status) {
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
