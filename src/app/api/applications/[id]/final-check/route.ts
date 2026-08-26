import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { canRunFinalCheck, computeReadiness } from '@/features/apply/domain';
import { loadComponentStates, loadDocumentTexts } from '@/features/apply/api';
import { FINAL_CHECK_PROMPT_VERSION, generateFinalCheck } from '@/lib/ai/final-check';
import { createClient } from '@/lib/supabase/server';

/**
 * Runs the Final Application Check for one application.
 *
 * Ownership is enforced by selecting `course_applications` with `user_id`, so a
 * request for someone else's application is indistinguishable from one for an
 * application that does not exist. Both 404.
 *
 * The readiness percentage is computed here from the same domain function the
 * page uses, never taken from the model — see src/lib/ai/final-check.ts.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, course_name, university_name, universities(name)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const components = await loadComponentStates(supabase, user.id, applicationId);
  if (!canRunFinalCheck(components)) {
    return NextResponse.json(
      { error: 'Attach at least two application documents before running the final check.' },
      { status: 422 },
    );
  }

  const documents = await loadDocumentTexts(supabase, applicationId);
  const universities = application.universities as { name?: string } | null;

  const result = await generateFinalCheck({
    courseName: (application.course_name as string | null) ?? 'This course',
    universityName:
      universities?.name ?? (application.university_name as string | null) ?? 'This university',
    components,
    documents,
    intendedPositioning: null,
  });

  if (result.status === 'not_configured') {
    return NextResponse.json(
      { error: 'The AI service is not configured. Missing OPENAI_API_KEY.' },
      { status: 503 },
    );
  }
  if (result.status === 'error') {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  const readiness = computeReadiness(components, result.generation.documentReviews);

  // Hashing the components plus the document text means a rerun over unchanged
  // documents is identifiable as such, without storing the documents twice.
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ components, documents }))
    .digest('hex');

  const { data: inserted, error: insertError } = await supabase
    .from('application_final_checks')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      readiness_percent: readiness.percent,
      components,
      document_reviews: result.generation.documentReviews,
      narrative_audit: result.generation.narrativeAudit,
      limitations: result.generation.limitations,
      input_hash: inputHash,
      prompt_version: FINAL_CHECK_PROMPT_VERSION,
      model_name: result.model,
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    // The migration ships separately from this code, following the pattern the
    // rest of this repo uses. A missing table is a 503 with a named hint, not a
    // 500 — see known-issues.md §0e.
    const missing = /PGRST205|42P01|schema cache|does not exist/i.test(
      `${insertError.code ?? ''} ${insertError.message ?? ''}`,
    );
    return NextResponse.json(
      {
        error: missing
          ? 'Final Check is not enabled in this environment. Run supabase-final-check.sql.'
          : 'We could not save the check.',
      },
      { status: missing ? 503 : 500 },
    );
  }

  return NextResponse.json({
    id: inserted?.id ?? null,
    readinessPercent: readiness.percent,
    criticalActions: readiness.criticalActions,
  });
}
