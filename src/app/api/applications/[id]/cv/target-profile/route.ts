import { NextResponse } from 'next/server';
import { requireApplicationOwner } from '@/server/auth';
import {
  getOrCreateStrategy,
  getTargetProfile,
  migrationAwareError,
  badRequest,
  upsertTargetProfile,
} from '@/features/application-strategy/api';
import { isNoopPatch, targetProfilePatchSchema } from '@/features/application-strategy/domain';
import { trackApplicationEvent } from '@/lib/analytics/track';

/**
 * GET   /api/applications/[id]/cv/target-profile — read the seven fields.
 * PATCH /api/applications/[id]/cv/target-profile — save an edit, bumping version.
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
    const targetProfile = await getTargetProfile(supabase, strategy.id);
    return NextResponse.json({ ok: true, targetProfile });
  } catch (err) {
    return migrationAwareError(err, 'Could not load your target profile.');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user } = owner;

  const body = targetProfilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest('Those target profile fields could not be saved.');

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    const existing = await getTargetProfile(supabase, strategy.id);

    /*
     * A patch that changes nothing must not reach the repository, because
     * `upsertTargetProfile` bumps `version` unconditionally and a version that
     * moves invalidates the CV review the student may just have paid for.
     * Blurring a field without typing is the common case that would otherwise do
     * it, and the autosave hook fires on every keystroke pause.
     */
    if (existing && isNoopPatch(existing, body.data)) {
      return NextResponse.json({ ok: true, targetProfile: existing, unchanged: true });
    }

    const targetProfile = await upsertTargetProfile(supabase, {
      userId: user.id,
      strategyId: strategy.id,
      patch: body.data,
    });

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_target_profile_edited',
      metadata: { version: targetProfile.version },
    });

    // `version` is returned at the top level as well because the autosave hook
    // reads it there for every editor in this feature.
    return NextResponse.json({ ok: true, targetProfile, version: targetProfile.version });
  } catch (err) {
    return migrationAwareError(err, 'Could not save your target profile.');
  }
}
