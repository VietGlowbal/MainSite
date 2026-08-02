import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationOwner } from '@/server/auth';
import {
  badRequest,
  getOrCreateStrategy,
  getStructuredCv,
  migrationAwareError,
  strategyAdminClient,
  upsertStructuredCv,
} from '@/features/application-strategy/api';
import { canExport, recommendLayout } from '@/features/application-strategy/domain';
import { getTargetProfile } from '@/features/application-strategy/api';
import { cvExportFileName, cvExportPath, renderCvPdf } from '@/lib/cv-pdf';
import { applyRateLimit, strategyExportLimiter } from '@/lib/rate-limiter';
import { trackApplicationEvent } from '@/lib/analytics/track';

/**
 * POST /api/applications/[id]/cv/export — render the CV to PDF and store it.
 *
 * Returns a short-lived signed URL rather than the bytes. Two reasons: the student
 * usually wants to download it more than once and a stored object makes that free,
 * and having an artefact is what makes "your PDF is older than your CV" a real
 * comparison rather than a guess.
 *
 * The object name embeds the content version, so re-exporting the same version
 * overwrites the same object and is idempotent.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'student-documents';
/** Long enough to download, short enough that a leaked link is not a leaked CV. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

const bodySchema = z
  .object({ layout: z.enum(['academic', 'technical', 'leadership']).optional() })
  .nullable();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest('That export request could not be read.');

  const limited = applyRateLimit(strategyExportLimiter, user.id, 'CV export');
  if (limited) return limited;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    const cv = await getStructuredCv(supabase, strategy.id);

    if (!cv || !canExport(cv)) {
      return NextResponse.json(
        { ok: false, reason: 'no_content', error: 'There is no CV content to export yet.' },
        { status: 409 },
      );
    }

    /*
     * Layout precedence: what this request asked for, then what the student saved,
     * then the recommendation. The last fallback matters — a student who reached
     * export without choosing gets the layout we would have recommended rather
     * than an arbitrary first-in-the-list.
     */
    let layout = body.data?.layout ?? cv.selectedLayout;
    if (!layout) {
      const targetProfile = await getTargetProfile(supabase, strategy.id);
      layout = recommendLayout(targetProfile, cv).key;
    }

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_export_started',
      metadata: { layout, contentVersion: cv.contentVersion },
    });

    const candidateName =
      (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? null;

    const pdf = await renderCvPdf({ layout, cv, candidateName });

    const path = cvExportPath({
      userId: user.id,
      strategyId: strategy.id,
      contentVersion: cv.contentVersion,
    });

    // Service role for storage: bucket objects are not covered by a table policy,
    // and the path is built from the authenticated user's own id so it cannot
    // reach another student's folder.
    const admin = strategyAdminClient();

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, pdf, {
      contentType: 'application/pdf',
      // Same version, same object: re-exporting is idempotent rather than
      // accumulating copies.
      upsert: true,
    });

    if (uploadError) {
      console.error('[cv-export] upload failed:', uploadError);
      await trackApplicationEvent({
        supabase,
        applicationId: id,
        userId: user.id,
        eventType: 'cv_export_failed',
        metadata: { stage: 'upload' },
      });
      return NextResponse.json({ ok: false, error: 'Export failed.' }, { status: 500 });
    }

    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    // Recorded only after the object exists. Setting it earlier would report a
    // current export for a file that failed to upload.
    await upsertStructuredCv(supabase, {
      userId: user.id,
      strategyId: strategy.id,
      selectedLayout: layout,
      lastExportedVersion: cv.contentVersion,
    });

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_export_completed',
      metadata: { layout, contentVersion: cv.contentVersion, bytes: pdf.byteLength },
    });

    return NextResponse.json({
      ok: true,
      url: signed?.signedUrl ?? null,
      fileName: cvExportFileName({
        candidateName,
        courseName: application.course_name,
      }),
      contentVersion: cv.contentVersion,
      layout,
    });
  } catch (err) {
    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_export_failed',
      metadata: { stage: 'render' },
    }).catch(() => undefined);
    return migrationAwareError(err, 'Export failed.');
  }
}
