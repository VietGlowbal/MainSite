import { NextResponse } from 'next/server';
import { requireApplicationOwner } from '@/server/auth';
import {
  aiFailureResponse,
  assembleStrategyContext,
  getOrCreateStrategy,
  getTargetProfile,
  migrationAwareError,
  strategyAdminClient,
  upsertTargetProfile,
} from '@/features/application-strategy/api';
import {
  deterministicGaps,
  generateTargetProfile,
  mergeMissingInformation,
  toTargetProfilePatch,
} from '@/lib/ai/strategy/target-profile';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { trackApplicationEvent } from '@/lib/analytics/track';

/**
 * POST /api/applications/[id]/cv/target-profile/generate
 *
 * Generates the seven fields from the programme material and the student's
 * profile, then saves them as editable content.
 *
 * WHY IT SAVES RATHER THAN RETURNING A DRAFT. Unlike the CV import — which must
 * not overwrite content the student typed — the target profile is Glowbal's
 * analysis of a programme, and the student's own edits to it come after. The
 * regenerate action is explicit and the previous version number is recorded, so
 * nothing is silently lost.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'target profile generation');
  if (limited) return limited;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);

    const contextData = await assembleStrategyContext({
      supabase,
      admin: strategyAdminClient(),
      userId: user.id,
      applicationId: id,
      strategyId: strategy.id,
      application,
    });

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_target_profile_generated',
      eventLabel: 'started',
      metadata: { hasProgramme: contextData.inputsPresent.programme },
    });

    const result = await generateTargetProfile(contextData);
    if (!result.ok) return aiFailureResponse(result.reason);

    /*
     * Gaps we can prove without a model are merged in. The model is asked to
     * report what it could not establish, but it cannot know that the student's
     * profile has no career goal recorded — only that the field was blank in the
     * prompt. Both lists together are what the student needs to act on.
     */
    const missingInformation = mergeMissingInformation(
      result.data.missingInformation,
      deterministicGaps(contextData),
    );

    const targetProfile = await upsertTargetProfile(supabase, {
      userId: user.id,
      strategyId: strategy.id,
      patch: {
        ...toTargetProfilePatch(result.data),
        missingInformation,
        sourcesUsed: result.data.sourcesUsed,
      },
      generated: true,
    });

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_target_profile_generated',
      eventLabel: 'completed',
      metadata: {
        version: targetProfile.version,
        model: result.model,
        missingCount: missingInformation.length,
      },
    });

    return NextResponse.json({ ok: true, targetProfile });
  } catch (err) {
    // A failure after the model call means the write failed, not the generation.
    // The student is told to retry, and a retry regenerates — acceptable, because
    // the alternative is caching a response we could not persist.
    try {
      const strategy = await getOrCreateStrategy(supabase, user.id, id);
      const existing = await getTargetProfile(supabase, strategy.id);
      if (existing) {
        await trackApplicationEvent({
          supabase,
          applicationId: id,
          userId: user.id,
          eventType: 'cv_target_profile_generated',
          eventLabel: 'failed',
        });
      }
    } catch {
      // Analytics must never turn one failure into two.
    }
    return migrationAwareError(err, 'Could not generate your target profile.');
  }
}
