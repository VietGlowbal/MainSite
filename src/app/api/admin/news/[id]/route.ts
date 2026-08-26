import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import {
  deleteArticle,
  GeoArticleConflictError,
  getArticleById,
  updateArticle,
  validateArticleForPublish,
} from '@/lib/geo-cms';
import { countOfficialSources, listPublicationBlockers } from '@/lib/geo-cms-validation';

/** Refresh the public pages that render GEO articles after a mutation. */
function revalidateArticle(slug?: string, previousSlug?: string) {
  revalidatePath('/news');
  if (slug) revalidatePath(`/news/${slug}`);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/news/${previousSlug}`);
}

/**
 * Admin GEO News CMS API (single article).
 *
 *   GET    /api/admin/news/:id  → fetch one article (any status)
 *   PATCH  /api/admin/news/:id  → update fields / change status (publish, etc.)
 *   DELETE /api/admin/news/:id  → permanently remove an article
 *
 * All guard with isAdmin() against the calling user.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { ok: false as const, error: 'Forbidden', status: 403 as const };
  return { ok: true as const, user };
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
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
  expected_updated_at: z.string().datetime({ offset: true }).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  try {
    const article = await getArticleById(id);
    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    return NextResponse.json({ article });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  try {
    const existing = await getArticleById(id);
    if (!existing) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

    if (parsed.data.status === 'published') {
      const merged = { ...existing, ...parsed.data };
      const errors = validateArticleForPublish(merged);
      /*
       * The same publication-quality gate the pipeline and the public read
       * path use — one validator, three call sites (see geo-cms-validation.ts).
       * An explicit "publish" request is the admin's human sign-off, so the
       * review flag is not demanded again here; the pipeline's own
       * config.requireHumanReview still gates generated content upstream.
       */
      const blockers = listPublicationBlockers({
        slug: merged.slug,
        title: merged.title,
        description: merged.description,
        excerpt: merged.excerpt,
        body: merged.body,
        officialSourceCount: countOfficialSources(merged.meta),
      });
      if (errors.length || blockers.length) {
        return NextResponse.json(
          { error: 'Publication blocked', ...(errors.length ? { errors } : {}), ...(blockers.length ? { blockers } : {}) },
          { status: 400 },
        );
      }
    }

    const article = await updateArticle(id, parsed.data);
    revalidateArticle(article.slug, existing.slug);
    return NextResponse.json({ article });
  } catch (err) {
    if (err instanceof GeoArticleConflictError) {
      return NextResponse.json({ error: err.message, code: 'ARTICLE_CONFLICT' }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  try {
    const existing = await getArticleById(id);
    await deleteArticle(id);
    revalidateArticle(existing?.slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
