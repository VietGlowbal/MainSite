import { NextResponse } from 'next/server';
import { requireApplicationOwner } from '@/server/auth';
import {
  badRequest,
  getOrCreateStrategy,
  getStructuredCv,
  migrationAwareError,
  upsertStructuredCv,
} from '@/features/application-strategy/api';
import { structuredCvPatchSchema } from '@/features/application-strategy/domain';

/**
 * GET   /api/applications/[id]/cv — the structured CV.
 * PATCH /api/applications/[id]/cv — save sections or the selected layout.
 *
 * Sections are replaced wholesale rather than merged. The editor owns the whole
 * document and PATCHes it back; merging would mean reconciling a deleted entry
 * against an array index, which is more moving parts than rewriting a structure
 * that is a few kilobytes.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user } = owner;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    const cv = await getStructuredCv(supabase, strategy.id);
    return NextResponse.json({ ok: true, cv });
  } catch (err) {
    return migrationAwareError(err, 'Could not load your CV content.');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user } = owner;

  const body = structuredCvPatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest('That CV content could not be saved.');

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);

    const cv = await upsertStructuredCv(supabase, {
      userId: user.id,
      strategyId: strategy.id,
      ...(body.data.sections !== undefined ? { sections: body.data.sections } : {}),
      ...(body.data.selectedLayout !== undefined ? { selectedLayout: body.data.selectedLayout } : {}),
      ...(body.data.sourceDocumentId !== undefined
        ? { sourceDocumentId: body.data.sourceDocumentId }
        : {}),
    });

    // `version` at the top level for the autosave hook, which reads it there for
    // all three editors in this feature.
    return NextResponse.json({ ok: true, cv, version: cv.contentVersion });
  } catch (err) {
    return migrationAwareError(err, 'Could not save your CV content.');
  }
}
