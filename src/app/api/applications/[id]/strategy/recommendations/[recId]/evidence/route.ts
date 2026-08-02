import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/applications/[id]/strategy/recommendations/[recId]/evidence
 *
 * Links an already-uploaded `uploaded_documents` row to a recommendation
 * (requirements.md Requirement 14.1-14.2). The file itself is uploaded via
 * the existing `useDocumentUpload` client hook straight to Storage; this
 * route only sets `recommendation_id` on the resulting row, scoped to
 * documents the caller owns.
 */
export const runtime = 'nodejs';

const bodySchema = z.object({
  documentId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recId: string }> },
) {
  const { id: applicationId, recId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const { data: recommendation } = await supabase
    .from('application_recommendations')
    .select('id')
    .eq('id', recId)
    .eq('application_id', applicationId)
    .maybeSingle();
  if (!recommendation) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('uploaded_documents')
    .update({ recommendation_id: recId })
    .eq('id', parsed.data.documentId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[strategy/recommendations/:id/evidence] link failed', error);
    return NextResponse.json({ error: 'Could not attach evidence' }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
