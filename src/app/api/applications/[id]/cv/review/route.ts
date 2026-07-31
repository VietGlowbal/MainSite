import { NextResponse } from 'next/server';
import { requireApplicationOwner } from '@/server/auth';
import {
  aiFailureResponse,
  assembleStrategyContext,
  getLatestCvReview,
  getOrCreateStrategy,
  getStructuredCv,
  getTargetProfile,
  insertCvReview,
  migrationAwareError,
  strategyAdminClient,
  upsertStructuredCv,
} from '@/features/application-strategy/api';
import { countEntries } from '@/features/application-strategy/domain';
import { reviewCv } from '@/lib/ai/strategy/cv-review';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { trackApplicationEvent } from '@/lib/analytics/track';

/**
 * GET  /api/applications/[id]/cv/review — the latest stored review.
 * POST /api/applications/[id]/cv/review — run a new one.
 *
 * Reviews are append-only. Each row records the CV content version and the target
 * profile version it was run against, which is what makes "your CV has changed
 * since this review" a comparison of two integers rather than a guess about
 * timestamps.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user } = owner;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    const cv = await getStructuredCv(supabase, strategy.id);
    const review = cv ? await getLatestCvReview(supabase, cv.id) : null;
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    return migrationAwareError(err, 'Could not load your CV review.');
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    const [cv, targetProfile] = await Promise.all([
      getStructuredCv(supabase, strategy.id),
      getTargetProfile(supabase, strategy.id),
    ]);

    /*
     * Refuse rather than store an empty review. A review of nothing would be
     * saved with a content version, and the staleness comparison would then
     * report it as current — so the student would see "reviewed, no issues" for a
     * CV that does not exist.
     */
    if (!cv || countEntries(cv.sections) === 0) {
      return NextResponse.json(
        { ok: false, reason: 'missing_cv_content', error: 'There is no CV content to review yet.' },
        { status: 409 },
      );
    }

    if (!targetProfile) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'missing_target_profile',
          error: 'Create your target profile first — the review is scored against it.',
        },
        { status: 409 },
      );
    }

    const limited = applyRateLimit(strategyAiLimiter, user.id, 'CV review');
    if (limited) return limited;

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_review_started',
      metadata: { contentVersion: cv.contentVersion },
    });

    const contextData = await assembleStrategyContext({
      supabase,
      admin: strategyAdminClient(),
      userId: user.id,
      applicationId: id,
      strategyId: strategy.id,
      application,
    });

    const result = await reviewCv({ context: contextData, targetProfile });

    if (!result.ok) {
      await trackApplicationEvent({
        supabase,
        applicationId: id,
        userId: user.id,
        eventType: 'cv_review_failed',
        metadata: { reason: result.reason },
      });
      return aiFailureResponse(result.reason);
    }

    const review = await insertCvReview(supabase, {
      userId: user.id,
      cvId: cv.id,
      // Recorded from the CV we actually read, not from "now". If the student
      // saves an edit while the model call is in flight, this review is correctly
      // attributed to the older version and immediately reads as outdated.
      targetProfileVersion: targetProfile.version,
      contentVersion: cv.contentVersion,
      strengths: result.data.strengths,
      missingSignals: result.data.missingSignals,
      summary: result.data.summary,
      sourcesUsed: result.data.sourcesUsed,
      model: result.model,
      promptVersion: result.promptVersion,
    });

    await upsertStructuredCv(supabase, {
      userId: user.id,
      strategyId: strategy.id,
      lastReviewedVersion: cv.contentVersion,
    });

    await trackApplicationEvent({
      supabase,
      applicationId: id,
      userId: user.id,
      eventType: 'cv_review_completed',
      metadata: {
        strengthCount: result.data.strengths.length,
        missingSignalCount: result.data.missingSignals.length,
        criticalCount: result.data.missingSignals.filter((s) => s.critical).length,
        model: result.model,
      },
    });

    return NextResponse.json({ ok: true, review });
  } catch (err) {
    return migrationAwareError(err, 'Could not review your CV.');
  }
}
