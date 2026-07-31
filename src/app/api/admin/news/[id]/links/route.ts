import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getArticleById, listLinksForArticle, replaceArticleLinks } from '@/lib/geo-cms';

/**
 * Manage an article's outgoing GEO graph edges.
 *
 *   GET /api/admin/news/:id/links → list edges
 *   PUT /api/admin/news/:id/links → replace the full edge set
 *
 * Admin-gated.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { ok: false as const, error: 'Forbidden', status: 403 as const };
  return { ok: true as const, user };
}

const putSchema = z.object({
  links: z.array(
    z.object({
      to_article_id: z.string().uuid(),
      relation: z.enum(['related', 'cluster', 'prerequisite', 'next', 'cites']),
      weight: z.number().int().optional(),
    }),
  ),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  try {
    const links = await listLinksForArticle(id);
    return NextResponse.json({ links });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  try {
    await replaceArticleLinks(
      id,
      parsed.data.links.map((l) => ({ ...l, weight: l.weight ?? 0 })),
    );
    // The article's "Related" rail is part of its rendered page.
    const article = await getArticleById(id);
    if (article) revalidatePath(`/news/${article.slug}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
