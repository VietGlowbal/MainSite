import { NextResponse } from 'next/server';
import { requireApplicationOwner } from '@/server/auth';
import { getOrCreateStrategy, getStrategyOverview } from '@/features/application-strategy/api';

/**
 * GET  /api/applications/[id]/strategy — the overview view model.
 * POST /api/applications/[id]/strategy — create the strategy row if absent.
 *
 * The overview page renders server-side and does not call this; it exists for the
 * client-side refresh after an autosave or a re-analysis, so the two workspace
 * cards can update without a full navigation. Both share `getStrategyOverview`,
 * so the page and the endpoint cannot report different statuses.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user, application } = owner;

  try {
    const overview = await getStrategyOverview(supabase, {
      userId: user.id,
      applicationId: id,
      application,
    });
    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    return migrationAwareError(err, 'Could not load your strategy.');
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const owner = await requireApplicationOwner(id);
  if ('response' in owner) return owner.response;

  const { supabase, user } = owner;

  try {
    const strategy = await getOrCreateStrategy(supabase, user.id, id);
    return NextResponse.json({ ok: true, strategyId: strategy.id, status: strategy.status });
  } catch (err) {
    return migrationAwareError(err, 'Could not start your strategy.');
  }
}

/**
 * Turn a missing-table error into an actionable message.
 *
 * Migrations in this repo are applied by hand in the Supabase SQL editor, so
 * "relation does not exist" is a genuinely likely first-run state rather than an
 * impossible one. Reporting it as a generic 500 sends the next person debugging
 * the route instead of running the file. Same treatment the match-insights route
 * gives its 42703.
 */
function migrationAwareError(err: unknown, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[strategy]', message);

  if (/does not exist|relation .* does not exist|42P01/i.test(message)) {
    return NextResponse.json(
      {
        error:
          'Application Strategy needs a one-time database update. Run supabase-application-strategy.sql in the Supabase SQL editor, then try again.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}
