import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApplicationOwner } from '@/server/auth';
import {
  aiFailureResponse,
  assembleStrategyContext,
  badRequest,
  getOrCreateStrategy,
  getTargetProfile,
  migrationAwareError,
  strategyAdminClient,
} from '@/features/application-strategy/api';
import { suggestCvLine } from '@/lib/ai/strategy/cv-entry-suggestion';
import { CV_SUGGESTION_ACTION_KEYS } from '@/features/application-strategy/domain';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';

/**
 * POST /api/applications/[id]/cv/suggest
 *
 * Rewrites one CV line and returns `{ original, suggested }`. It performs NO
 * mutation — not of the CV, not of anything. The student accepts or dismisses in
 * the UI, and accepting is an ordinary edit that flows through the normal autosave.
 *
 * That separation is what makes "AI never silently overwrites student content" a
 * structural property rather than a promise: there is no code path from this
 * response to a persisted field.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  action: z.enum(CV_SUGGESTION_ACTION_KEYS),
  line: z.string().min(3).max(2000),
  section: z.string().max(60),
  role: z.string().max(300).nullish(),
  organization: z.string().max(300).nullish(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest('That suggestion request could not be read.');

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'CV suggestions');
  if (limited) return limited;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);

    const [contextData, targetProfile] = await Promise.all([
      assembleStrategyContext({
        supabase,
        admin: strategyAdminClient(),
        userId: user.id,
        applicationId: id,
        strategyId: strategy.id,
        application,
      }),
      getTargetProfile(supabase, strategy.id),
    ]);

    const result = await suggestCvLine({
      context: contextData,
      targetProfile,
      action: body.data.action,
      line: body.data.line,
      entryContext: {
        section: body.data.section,
        role: body.data.role ?? null,
        organization: body.data.organization ?? null,
      },
    });

    if (!result.ok) return aiFailureResponse(result.reason);

    return NextResponse.json({
      ok: true,
      original: result.original,
      suggested: result.suggested,
      note: result.note,
      /*
       * The model is allowed to decline. When it returns the line unchanged —
       * because there is no confirmed evidence to add, say — the UI shows the note
       * instead of a suggestion card offering to replace text with itself.
       */
      unchanged: result.suggested.trim() === result.original.trim(),
    });
  } catch (err) {
    return migrationAwareError(err, 'Could not generate a suggestion.');
  }
}
