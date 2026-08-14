import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createArticle, listArticlesForAdmin, validateArticleForPublish } from '@/lib/geo-cms';

/** Refresh the public pages that render GEO articles after a mutation. */
function revalidateArticle(slug?: string) {
  revalidatePath('/news');
  if (slug) revalidatePath(`/news/${slug}`);
}

/**
 * Admin GEO News CMS API (collection).
 *
 *   GET  /api/admin/news   → list every article (all statuses)
 *   POST /api/admin/news   → create a new article
 *
 * Both guard with isAdmin() against the calling user; writes run through the
 * service-role client inside src/lib/geo-cms.ts.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { ok: false as const, error: 'Forbidden', status: 403 as const };
  return { ok: true as const, user };
}

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().optional(),
  description: z.string().nullish(),
  excerpt: z.string().nullish(),
  key_takeaway: z.string().nullish(),
  body: z.string().optional(),
  topic: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hero_image: z.string().nullish(),
  hero_image_style: z.enum(['ai', 'svg-fallback']).nullish(),
  reading_time_minutes: z.number().int().positive().nullish(),
  meta: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const articles = await listArticlesForAdmin();
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = articleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  if (parsed.data.status === 'published') {
    const errors = validateArticleForPublish(parsed.data);
    if (errors.length) return NextResponse.json({ error: 'Complete the publish checklist', errors }, { status: 400 });
  }

  try {
    const article = await createArticle(parsed.data, guard.user.id);
    revalidateArticle(article.slug);
    return NextResponse.json({ article }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
