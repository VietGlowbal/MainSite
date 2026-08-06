import { NextResponse } from 'next/server';
import {
  candidateContextHash,
  getPersonalReportRecord,
  loadCandidateContext,
} from '@/features/apply/api';
import {
  REPORT_PROMPT_VERSION,
  hydratePersonalReport,
} from '@/features/apply/domain';
import { generatePersonalReportDraft } from '@/lib/ai/personal-report';
import { isOpenAIConfigured } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// A valid report may require one bounded schema/evidence repair. Each
// provider call is capped at 45s, so 120s leaves room for both calls and
// the surrounding authenticated reads/write without unbounded retries.
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
    getPersonalReportRecord(supabase, user.id),
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
  if (
    current &&
    current.inputHash === inputHash &&
    current.promptVersion === REPORT_PROMPT_VERSION
  ) {
    return NextResponse.json({
      report: current.report,
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
          report: current.report,
          stale: true,
          nextRegenerationAt: nextAt,
        },
        { status: 429 },
      );
    }
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: 'Dịch vụ AI chưa được cấu hình. Thiếu OPENAI_API_KEY.' },
      { status: 503 },
    );
  }

  try {
    const generated = await generatePersonalReportDraft(context);
    const report = hydratePersonalReport(generated.draft, context);
    const now = new Date().toISOString();
    const { error } = await supabase.from('student_personal_reports').upsert(
      {
        user_id: user.id,
        report,
        input_hash: inputHash,
        prompt_version: REPORT_PROMPT_VERSION,
        model_name: generated.model,
        generated_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      const migrationMissing =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /student_personal_reports/i.test(error.message ?? '');
      console.error('[personal-report] upsert failed', error);
      return NextResponse.json(
        {
          error: migrationMissing
            ? 'Tính năng báo cáo chưa được kích hoạt trong môi trường này.'
            : 'Không thể lưu báo cáo.',
        },
        { status: migrationMissing ? 503 : 500 },
      );
    }

    return NextResponse.json({
      report,
      cached: false,
      nextRegenerationAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    console.error('[personal-report] generation failed', {
      code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
    return NextResponse.json(
      {
        error: 'AI chưa thể tạo báo cáo hợp lệ. Báo cáo cũ, nếu có, vẫn được giữ nguyên.',
        ...(current ? { report: current.report } : {}),
      },
      { status: 502 },
    );
  }
}
