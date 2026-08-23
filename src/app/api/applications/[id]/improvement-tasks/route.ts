import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import { PILLAR_BY_KEY, PILLAR_ORDER, type ImprovementAction, type PillarKey } from '@/lib/match-insights';
import { logger, startTimer } from '@/server/observability';

/**
 * POST /api/applications/[id]/improvement-tasks   { pillar?: PillarKey }
 *
 * Plus-only. Adds clearly-labelled "improvement" tasks to the application's
 * checklist, taken from the latest match analysis. With a `pillar` it adds that
 * pillar's improvements; without one it adds every pillar's. Completing these
 * tasks raises the projected match score (each carries an estimated uplift).
 * Idempotent-ish: skips improvements whose title is already on the checklist.
 */
const BodySchema = z.object({
  pillar: z.enum(PILLAR_ORDER as [PillarKey, ...PillarKey[]]).optional(),
});

const ACTION_LABELS: Record<ImprovementAction['actionType'], string | undefined> = {
  upload_document: 'Upload',
  internal_route: 'Open',
  external_url: 'Open link',
  book_mentor: 'Book an advisor',
  none: undefined,
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const getElapsed = startTimer();
  const { id: applicationId } = await context.params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('roadmap_tasks_generate', {
    userId: user.id,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });

  // Plus gate.
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('plus_status, plus_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!isPlusEntitlementActive(profile ?? {})) {
    logger.warn('roadmap_tasks_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'rate_limited',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Improvement tasks are a GlowBal Plus feature.', upgrade: true },
      { status: 403 },
    );
  }

  // Ownership check + latest analysis with the pillar breakdown.
  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { data: analysis } = await supabase
    .from('application_match_analyses')
    .select('pillars')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analysis?.pillars) {
    logger.warn('roadmap_tasks_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'missing_inputs',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Run a match analysis first.' }, { status: 409 });
  }

  const pillarsData = analysis.pillars as Record<string, { improvements?: ImprovementAction[] }>;
  const targetKeys = parsed.data.pillar ? [parsed.data.pillar] : PILLAR_ORDER;
  const improvements: ImprovementAction[] = targetKeys.flatMap(
    (k) => pillarsData[k]?.improvements ?? [],
  );
  if (improvements.length === 0) {
    logger.info('roadmap_tasks_generate', {
      userId: user.id,
      applicationId,
      stage: 'completed',
      outcome: 'success',
      durationMs: getElapsed(),
      metadata: { added: 0 },
    });
    return NextResponse.json({ ok: true, added: 0, tasks: [] });
  }

  // Attach to the first stage so the tasks render in the checklist.
  const { data: firstStage } = await supabase
    .from('application_stages')
    .select('id')
    .eq('application_id', applicationId)
    .order('order_num', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Skip improvements already on the checklist (by title).
  const { data: existing } = await supabase
    .from('application_tasks')
    .select('title')
    .eq('application_id', applicationId)
    .eq('task_type', 'improvement');
  const existingTitles = new Set((existing ?? []).map((t) => (t.title ?? '').trim().toLowerCase()));

  const rows = improvements
    .filter((imp) => !existingTitles.has(imp.label.trim().toLowerCase()))
    .map((imp, i) => {
      const pillarLabel = PILLAR_BY_KEY[imp.pillar]?.label ?? 'Match';
      return {
        application_id: applicationId,
        stage_id: firstStage?.id ?? null,
        title: imp.label,
        description: `${imp.detail}${imp.detail ? ' ' : ''}(Improvement · ${pillarLabel} · +${imp.estimatedUplift} to your match)`,
        task_type: 'improvement',
        status: 'not_started',
        priority: 'medium',
        action_label: ACTION_LABELS[imp.actionType],
        action_type: imp.actionType,
        action_target: imp.actionTarget ?? null,
        confidence: 0.8,
        sort_order: 1000 + i,
        created_by: 'ai',
        pillar: imp.pillar,
        estimated_uplift: imp.estimatedUplift,
      };
    });

  if (rows.length === 0) {
    logger.info('roadmap_tasks_generate', {
      userId: user.id,
      applicationId,
      stage: 'completed',
      outcome: 'success',
      durationMs: getElapsed(),
      metadata: { added: 0 },
    });
    return NextResponse.json({ ok: true, added: 0, tasks: [] });
  }

  const { data: created, error: insErr } = await supabase
    .from('application_tasks')
    .insert(rows)
    .select();
  if (insErr) {
    logger.error('roadmap_tasks_generate', insErr, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not add improvement tasks.' }, { status: 500 });
  }

  logger.info('roadmap_tasks_generate', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
    metadata: { added: created?.length ?? 0 },
  });

  return NextResponse.json({ ok: true, added: created?.length ?? 0, tasks: created });
}
