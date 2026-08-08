import { NextResponse } from 'next/server';
import { strategyRecommendationFromRow } from '@/features/ai-strategy-dashboard/domain';
import { renderStrategyPdf, strategyExportFileName, strategyExportPath } from '@/lib/strategy-pdf';
import { applyRateLimit, strategyExportLimiter } from '@/lib/rate-limiter';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/applications/[id]/strategy/recommendation/export — render the
 * latest F7 report to PDF and store it.
 *
 * Same shape as `/api/applications/[id]/cv/export`: returns a short-lived
 * signed URL rather than the bytes, so a student who downloads twice does
 * not pay for a second render. See `lib/strategy-pdf/render.ts` on why the
 * storage path is keyed by the recommendation row's own id rather than a
 * content-version counter.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'student-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = applyRateLimit(strategyExportLimiter, user.id, 'strategy export');
  if (limited) return limited;

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, university_name, course_name')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const { data: latest } = await supabase
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recommendation = latest ? strategyRecommendationFromRow(latest) : null;
  if (!recommendation) {
    return NextResponse.json(
      { error: 'Generate your Personalized Strategy before exporting it.' },
      { status: 409 },
    );
  }

  const candidateName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? null;
  const programmeName = [application.course_name, application.university_name]
    .filter(Boolean)
    .join(' at ');

  let pdf: Buffer;
  try {
    pdf = await renderStrategyPdf({
      recommendation,
      candidateName,
      programmeName: programmeName || null,
    });
  } catch (err) {
    console.error('[strategy/recommendation/export] render failed', err);
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 });
  }

  const path = strategyExportPath({ userId: user.id, recommendationId: recommendation.id });

  // Service role for storage: bucket objects are not covered by a table
  // policy, and the path is built from the authenticated user's own id so it
  // cannot reach another student's folder — same reasoning as cv/export.
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) {
    console.error('[strategy/recommendation/export] upload failed', uploadError);
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  // Recorded only after the object exists, same ordering cv/export uses.
  await supabase
    .from('application_strategy_recommendations')
    .update({ pdf_storage_path: path })
    .eq('id', recommendation.id);

  return NextResponse.json({
    url: signed?.signedUrl ?? null,
    fileName: strategyExportFileName({ candidateName }),
  });
}
