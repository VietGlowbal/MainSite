import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';
import { getLatestApplicationMatchingAnalysis } from '@/features/apply/api';
import { generateApplicationMatchingReport } from '@/lib/ai/matching/generation';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';

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

  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('*, courses (*)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();
  if (appError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { record: latestV2 } = await getLatestApplicationMatchingAnalysis(
    supabase,
    { userId, applicationId },
    { analysisStatus: 'complete' },
  );

  const { data: profile } = await supabase.from('student_profiles').select('plus_status, plus_expires_at').eq('user_id', userId).maybeSingle();
  const isPlus = isPlusEntitlementActive(profile ?? {});

  const latestCreatedAt = latestV2 ? Date.parse(latestV2.createdAt) : Number.NaN;
  const nextRegenerationAt =
    latestV2 && !isPlus && Number.isFinite(latestCreatedAt)
      ? new Date(latestCreatedAt + COOLDOWN_MS).toISOString()
      : undefined;

  try {
    const result = await generateApplicationMatchingReport({
      supabase,
      userId,
      applicationId,
      cooldownUntil: nextRegenerationAt,
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

    if (result.status === 'cooldown') {
      return NextResponse.json(
        {
          error: "Your information has changed, but a free report regeneration isn't available yet.",
          stale: true,
          analysis: result.record,
          nextRegenerationAt: result.nextRegenerationAt,
        },
        { status: 429 },
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
