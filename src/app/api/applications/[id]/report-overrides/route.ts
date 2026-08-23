import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * GET  /api/applications/[id]/report-overrides?kind=strategy_f8
 * PUT  /api/applications/[id]/report-overrides   { itemKey, field, value }
 * DELETE /api/applications/[id]/report-overrides?kind=…&itemKey=…&field=…
 *
 * Student-authored edits layered over generated report content (see
 * supabase-report-overrides.sql). Ownership is enforced by RLS; this route
 * only validates shape and scopes every read to the signed-in user.
 */

const KINDS = ['strategy_f8'] as const;
const FIELDS = [
  'title',
  'currentSituation',
  'whyItMatters',
  'recommendedActions',
  'expectedImpact',
  'level',
] as const;

const putSchema = z.object({
  itemKey: z.string().regex(/^[a-z][a-z0-9_-]{2,60}$/),
  field: z.enum(FIELDS),
  value: z.unknown(),
});

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const kind = new URL(request.url).searchParams.get('kind') ?? 'strategy_f8';
  if (!KINDS.includes(kind as (typeof KINDS)[number])) {
    return NextResponse.json({ error: 'Unknown report kind' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('application_report_overrides')
    .select('item_key,field,value')
    .eq('application_id', applicationId)
    .eq('report_kind', kind);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      // Overrides table not migrated yet — the report renders generated base only.
      return NextResponse.json({ overrides: {} });
    }
    return NextResponse.json({ error: 'Could not load your edits.' }, { status: 500 });
  }

  const overrides: Record<string, Record<string, unknown>> = {};
  for (const row of data ?? []) {
    const key = String(row.item_key);
    (overrides[key] ??= {})[String(row.field)] = row.value;
  }
  return NextResponse.json({ overrides });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid override payload' }, { status: 400 });
  }
  const { itemKey, field, value } = parsed.data;

  const { error } = await supabase.from('application_report_overrides').upsert(
    {
      user_id: user.id,
      application_id: applicationId,
      report_kind: 'strategy_f8',
      item_key: itemKey,
      field,
      value: value === undefined ? null : value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'application_id,report_kind,item_key,field' },
  );
  if (error) {
    return NextResponse.json({ error: 'Could not save your edit.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'strategy_f8';
  const itemKey = url.searchParams.get('itemKey');
  const field = url.searchParams.get('field');
  if (!KINDS.includes(kind as (typeof KINDS)[number]) || !itemKey || !field) {
    return NextResponse.json({ error: 'itemKey and field are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('application_report_overrides')
    .delete()
    .eq('application_id', applicationId)
    .eq('report_kind', kind)
    .eq('item_key', itemKey)
    .eq('field', field);
  if (error) {
    return NextResponse.json({ error: 'Could not clear that edit.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
