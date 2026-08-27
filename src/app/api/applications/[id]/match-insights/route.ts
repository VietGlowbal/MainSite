import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import { logger, startTimer } from '@/server/observability';
import { generateApplicationMatchingReport } from '@/lib/ai/matching/generation';
import { getLatestApplicationMatchingAnalysis } from '@/features/apply/api/ai-reports-repository';

export const runtime = 'nodejs';
export const maxDuration = 120;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const getElapsed = startTimer();
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  logger.info('matching_report_generate', {
    userId,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });

  const { record: latestV2 } = await getLatestApplicationMatchingAnalysis(supabase, { userId, applicationId });

  const { data: profile } = await supabase.from('student_profiles').select('plus_status, plus_expires_at').eq('user_id', userId).maybeSingle();
  const isPlus = isPlusEntitlementActive(profile ?? {});

  if (latestV2 && !isPlus) {
    const nextAt = new Date(new Date(latestV2.createdAt).getTime() + COOLDOWN_MS);
    if (nextAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: "Your information has changed, but a free report regeneration isn't available yet.",
          stale: true,
          analysis: latestV2,
          nextRegenerationAt: nextAt.toISOString(),
        },
        { status: 429 },
      );
    }
  }

  try {
    const result = await generateApplicationMatchingReport({
      supabase,
      userId,
      applicationId,
    });

    if (result.status === 'not_configured') {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    if (result.status === 'not_ready') {
      return NextResponse.json(
        { error: result.reason, needsInputs: true },
        { status: 422 }
      );
    }

    if (result.status === 'migration_missing') {
      return NextResponse.json(
        { error: 'Matching Report needs a database update before it can be used.' },
        { status: 503 }
      );
    }

    if (result.status === 'cached') {
      return NextResponse.json({ ok: true, cached: true, analysis: result.record, reportV2: result.record.reportV2 });
    }

    return NextResponse.json({
      ok: true,
      cached: false,
      analysis: result.record,
      reportV2: result.record.reportV2,
      reusedCriterionIds: result.reusedCriterionIds,
    });
  } catch (error) {
    logger.error('matching_report_generate', error, {
      userId,
      applicationId,
      stage: 'generated',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      {
        error: 'The AI could not produce a valid Matching Report. Your previous report has been kept.',
        ...(latestV2 ? { analysis: latestV2 } : {}),
      },
      { status: 502 },
    );
  }
}
