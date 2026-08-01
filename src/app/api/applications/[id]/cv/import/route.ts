import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationOwner } from '@/server/auth';
import {
  aiFailureResponse,
  assembleStrategyContext,
  badRequest,
  getOrCreateStrategy,
  migrationAwareError,
  strategyAdminClient,
} from '@/features/application-strategy/api';
import { importCvText, sectionsFromProfile } from '@/lib/ai/strategy/cv-import';
import { extractDocumentText } from '@/lib/ai/document-text';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { trackApplicationEvent } from '@/lib/analytics/track';

/**
 * POST /api/applications/[id]/cv/import
 *
 * Three sources, one response shape: a DRAFT the student confirms on screen.
 *
 * THIS ROUTE NEVER WRITES `structured_cvs`. That is the whole design. The
 * requirement is that an import cannot silently destroy content the student typed,
 * and the way to guarantee it is to have no write path here at all — the student
 * confirms, and the confirmation is a separate PATCH to /cv. Cancelling therefore
 * leaves existing content untouched by construction rather than by anyone
 * remembering to check.
 *
 * `mode: 'profile'` does not call a model. Every fact in a Glowbal profile was
 * typed by the student; passing it through a model to rearrange introduces the
 * chance of it coming back subtly different for no benefit.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.union([
  z.object({ mode: z.literal('document'), documentId: z.string().uuid() }),
  z.object({ mode: z.literal('paste'), text: z.string().min(40).max(60000) }),
  z.object({ mode: z.literal('profile') }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest('That import request could not be read.');

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_import_started',
      metadata: { mode: body.data.mode },
    });

    // ── From the Glowbal profile: no model, no rate limit, deterministic. ──
    if (body.data.mode === 'profile') {
      const contextData = await assembleStrategyContext({
        supabase,
        admin: strategyAdminClient(),
        userId: user.id,
        applicationId: id,
        strategyId: strategy.id,
        application,
      });

      const sections = sectionsFromProfile({
        achievements: contextData.candidate.achievements as Record<string, unknown>[],
        activities: contextData.candidate.activities as Record<string, unknown>[],
        academics: contextData.candidate.academics,
      });

      await trackApplicationEvent({
        supabase,
        applicationId: id,
        userId: user.id,
        eventType: 'cv_import_completed',
        metadata: { mode: 'profile', sectionCount: sections.length },
      });

      return NextResponse.json({
        ok: true,
        draft: { sections, uncertain: {}, notes: [] },
        source: 'profile',
      });
    }

    // ── Resolve the text to parse. ──
    let text: string | null = null;
    let sourceDocumentId: string | null = null;

    if (body.data.mode === 'paste') {
      text = body.data.text;
    } else {
      const admin = strategyAdminClient();
      const { data: doc } = await supabase
        .from('uploaded_documents')
        .select('id, storage_key, mime_type, parsed_text')
        .eq('id', body.data.documentId)
        // Ownership again on the document itself. The application check does not
        // cover it: documents belong to the user, not to the application, so a
        // valid application id plus someone else's document id would otherwise
        // read a file that is not theirs.
        .eq('user_id', user.id)
        .maybeSingle();

      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

      sourceDocumentId = doc.id as string;

      const cached = (doc.parsed_text as string | null)?.trim();
      if (cached) {
        text = cached;
      } else {
        const extracted = await extractDocumentText(
          admin,
          doc.storage_key as string,
          doc.mime_type as string | null,
        );
        if (extracted) {
          await admin.from('uploaded_documents').update({ parsed_text: extracted }).eq('id', doc.id);
          text = extracted;
        }
      }

      /*
       * Unreadable is a first-class outcome, not an error. Scanned PDFs, images and
       * .docx all land here. The response says so explicitly so the UI can show the
       * four fallbacks — including a paste path that comes back through this same
       * route — rather than a generic failure that reads as the upload having been
       * thrown away.
       */
      if (!text || text.trim().length < 40) {
        await trackApplicationEvent({
          supabase,
          applicationId: id,
          userId: user.id,
          eventType: 'cv_import_failed',
          metadata: { mode: 'document', reason: 'unreadable' },
        });
        return NextResponse.json({ ok: false, reason: 'unreadable' }, { status: 200 });
      }
    }

    const limited = applyRateLimit(strategyAiLimiter, user.id, 'CV import');
    if (limited) return limited;

    const result = await importCvText(text);
    if (!result.ok) {
      await trackApplicationEvent({
        supabase,
        applicationId: id,
        userId: user.id,
        eventType: 'cv_import_failed',
        metadata: { mode: body.data.mode, reason: result.reason },
      });
      return aiFailureResponse(result.reason);
    }

    if (result.draft.sections.length === 0) {
      await trackApplicationEvent({
        supabase,
        applicationId: id,
        userId: user.id,
        eventType: 'cv_import_failed',
        metadata: { mode: body.data.mode, reason: 'no_content' },
      });
      return NextResponse.json({ ok: false, reason: 'no_content', notes: result.draft.notes });
    }

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_import_completed',
      metadata: {
        mode: body.data.mode,
        sectionCount: result.draft.sections.length,
        uncertainCount: Object.keys(result.draft.uncertain).length,
      },
    });

    return NextResponse.json({
      ok: true,
      draft: result.draft,
      sourceDocumentId,
      source: body.data.mode,
    });
  } catch (err) {
    return migrationAwareError(err, 'Could not import that CV.');
  }
}
