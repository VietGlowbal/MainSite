import { NextResponse } from 'next/server';
import {
  candidateContextHash,
  getPersonalReportV2Record,
  loadCandidateContext,
  savePersonalReportV2,
} from '@/features/apply/api';
import { buildPersonalReport } from '@/features/apply/domain';
import { buildProfileEvaluationInput } from '@/lib/ai/personal-report-v2';
import { isOpenAIConfigured } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';
import { ENGINE_VERSION, runProfileEvaluation, shouldRegenerate } from '@/shared/evaluation';

/**
 * The canonical, user-level Personal Report.
 *
 * ─── PIPELINE ─────────────────────────────────────────────────────────────
 *
 *   loadCandidateContext          (features/apply/api — profile, achievements,
 *                                   activities, tests, document presence)
 *   → buildProfileEvaluationInput  (lib/ai/personal-report-v2 — the 3 semantic
 *                                    extraction calls: CMCAITF, competency
 *                                    claims, role/theme)
 *   → runProfileEvaluation         (shared/evaluation — pure F1-F6 scoring,
 *                                    no I/O, no model call)
 *   → buildPersonalReport          (features/apply/domain — the six
 *                                    canonical sections, still pure)
 *
 * This route is the ONLY thing that calls a model for the Personal Report;
 * everything after `buildProfileEvaluationInput` is deterministic and
 * unit-tested without a key (see personal-report.test.ts,
 * engine.test.ts). It replaces the v1 pipeline
 * (`hydratePersonalReport`/`generatePersonalReportDraft`), which is
 * deprecated — see docs/ai-evaluation-engine.md.
 *
 * ─── IDEMPOTENCY AND THE COOLDOWN ────────────────────────────────────────
 *
 * `shouldRegenerate` (src/shared/evaluation/versioning.ts) is the storage
 * requirement's "regenerate only when inputs change" — it is checked BEFORE
 * the 24h cooldown that already existed on this route, so a student whose
 * profile has not changed at all gets the cached report regardless of the
 * cooldown clock. The cooldown only ever blocks a genuinely new generation.
 * This report has no `applicationId`, so changing a university application
 * can never affect `inputHash` and can never trigger regeneration — the
 * "global ownership" requirement is structurally true rather than checked.
 */

export const runtime = 'nodejs';
// Three sequential extraction calls (CMCAITF, competency, role/theme) run in
// parallel, each capped at 45s by openAiJsonCompletion's own default timeout;
// 120s leaves headroom for all three plus the surrounding DB reads/writes.
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
  const regenerate = shouldRegenerate(
    { inputHash },
    current ? { inputHash: current.inputHash, engineVersion: current.engineVersion ?? '' } : null,
  );

  if (current && !regenerate) {
    return NextResponse.json({
      reportV2: current.reportV2,
      cached: true,
      nextRegenerationAt: nextRegenerationAt(current.generatedAt),
    });
  }

  const isPlus = Boolean(profileResult.data?.plus_status);
  if (current && !isPlus) {
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
