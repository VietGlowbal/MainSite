import { NextResponse } from 'next/server';
import {
  candidateContextHash,
  getPersonalReportV2Record,
  loadCandidateContext,
  savePersonalReportV2,
} from '@/features/apply/api';
import { buildPersonalReport } from '@/features/apply/domain';
import {
  buildProfileEvaluationInput,
  PERSONAL_REPORT_EXTRACTION_VERSION,
} from '@/lib/ai/personal-report-v2';
import { isOpenAIConfigured } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';
import { ENGINE_VERSION, runProfileEvaluation, shouldRegenerate } from '@/shared/evaluation';

/**
 * Canonical user-level Personal Report generation.
 *
 * Semantic extraction is versioned separately from deterministic framework
 * scoring: improving a grounding prompt must invalidate old cached output even
 * when the student's source data did not change.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function nextRegenerationAt(generatedAt: string): string {
  return new Date(new Date(generatedAt).getTime() + COOLDOWN_MS).toISOString();
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const [context, stored, profileResult] = await Promise.all([
    loadCandidateContext(supabase, user.id),
    getPersonalReportV2Record(supabase, user.id),
    supabase.from('student_profiles').select('plus_status').eq('user_id', user.id).maybeSingle(),
  ]);
  if (stored.migrationMissing) {
    return NextResponse.json(
      { error: 'Tính năng báo cáo chưa được kích hoạt trong môi trường này.' },
      { status: 503 },
    );
  }

  const inputHash = candidateContextHash(context);
  const current = stored.record;
  const frameworkChanged = Boolean(current && current.engineVersion !== ENGINE_VERSION);
  const extractionChanged = Boolean(
    current && current.promptVersion !== PERSONAL_REPORT_EXTRACTION_VERSION,
  );
  const inputChanged = Boolean(current && current.inputHash !== inputHash);
  const regenerate =
    shouldRegenerate(
      { inputHash },
      current ? { inputHash: current.inputHash, engineVersion: current.engineVersion ?? '' } : null,
    ) || extractionChanged;

  if (current && !regenerate) {
    return NextResponse.json({
      reportV2: current.reportV2,
      cached: true,
      nextRegenerationAt: nextRegenerationAt(current.generatedAt),
    });
  }

  const isPlus = Boolean(profileResult.data?.plus_status);
  // Product cooldown applies when the student has changed their own inputs.
  // An internal framework/prompt upgrade must not leave a known-stale report
  // locked behind that cooldown, so version migrations can refresh once.
  if (current && !isPlus && inputChanged && !frameworkChanged && !extractionChanged) {
    const nextAt = nextRegenerationAt(current.generatedAt);
    if (Date.now() < new Date(nextAt).getTime()) {
      return NextResponse.json(
        {
          error: 'Bạn đã cập nhật dữ liệu, nhưng chưa thể tạo lại báo cáo miễn phí ngay lúc này.',
          reportV2: current.reportV2,
          stale: true,
          nextRegenerationAt: nextAt,
        },
        { status: 429 },
      );
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !isOpenAIConfigured()) {
    return NextResponse.json(
      { error: 'Dịch vụ AI chưa được cấu hình. Thiếu OPENAI_API_KEY.' },
      { status: 503 },
    );
  }

  try {
    const generatedAt = new Date().toISOString();
    const evaluationInput = await buildProfileEvaluationInput({
      context,
      subjectId: user.id,
      generatedAt,
      apiKey,
    });
    const evaluation = runProfileEvaluation(evaluationInput);
    const reportV2 = buildPersonalReport({
      evaluation,
      activities: evaluationInput.narrativeActivities,
      intendedDirection: evaluationInput.intendedDirection,
      generatedAt,
    });

    const { error } = await savePersonalReportV2(supabase, {
      userId: user.id,
      reportV2,
      evaluation,
      inputHash,
      engineVersion: ENGINE_VERSION,
      promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
      modelName: process.env.OPENAI_MODEL || 'gpt-4o',
    });
    if (error) {
      return NextResponse.json(
        {
          error: error.migrationMissing
            ? 'Tính năng báo cáo chưa được kích hoạt trong môi trường này.'
            : 'Không thể lưu báo cáo.',
        },
        { status: error.migrationMissing ? 503 : 500 },
      );
    }

    return NextResponse.json({
      reportV2,
      cached: false,
      nextRegenerationAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    console.error('[personal-report-v2] generation failed', {
      code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
    return NextResponse.json(
      {
        error: 'AI chưa thể tạo báo cáo hợp lệ. Báo cáo cũ, nếu có, vẫn được giữ nguyên.',
        ...(current ? { reportV2: current.reportV2 } : {}),
      },
      { status: 502 },
    );
  }
}
