import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';
import { resolveTargetProfile } from '@/lib/ai/target-profile/generation';

/**
 * POST /api/ai/target-profiles
 *
 * Resolves a reusable programme-level Target Profile from ALREADY-INGESTED
 * catalogue data. Body: `{ programmeId, scholarshipKey? }`.
 *
 * Response `status`:
 * - 'cached'  — newest stored version's source fingerprint still matches the
 *               current ingested rows; served as-is.
 * - 'stale'   — fingerprint mismatch detected; regenerated synchronously; the
 *               NEW version id is returned.
 * - 'ready'   — first successful generation for this programme(+scholarship).
 * - 'not_ready' (409) — required catalogue/source lineage is absent.
 *
 * The request accepts only a programmeId — never an arbitrary URL — and no
 * code path on it can initiate crawling.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  programmeId: z.string().uuid(),
  scholarshipKey: z.string().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const getElapsed = startTimer();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'programmeId (uuid) is required.' },
      { status: 422 },
    );
  }

  logger.info('applicant_analysis_generate', {
    userId: user.id,
    applicationId: undefined,
    stage: 'started',
    outcome: 'started',
    metadata: { operation: 'target_profile', programmeId: parsedBody.programmeId },
    durationMs: getElapsed(),
  });

  try {
    const result = await resolveTargetProfile({
      supabase,
      userId: user.id,
      programmeId: parsedBody.programmeId,
      scholarshipKey: parsedBody.scholarshipKey,
    });

    if (result.status === 'not_ready') {
      logger.warn('applicant_analysis_generate', {
        userId: user.id,
        stage: 'validated',
        outcome: 'not_ready',
        durationMs: getElapsed(),
      });
      return NextResponse.json(
        { status: 'not_ready', reason: result.reason, versionId: null, profile: null },
        { status: 409 },
      );
    }

    logger.info('applicant_analysis_generate', {
      userId: user.id,
      stage: 'completed',
      outcome: 'success',
      durationMs: getElapsed(),
      metadata: { operation: 'target_profile', targetProfileStatus: result.status },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('applicant_analysis_generate', error, {
      userId: user.id,
      stage: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not resolve the target profile' }, { status: 500 });
  }
}
