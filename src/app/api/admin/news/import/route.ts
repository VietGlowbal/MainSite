import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { listLegacyFileGuides } from '@/lib/geo-content';
import { upsertArticleBySlug, type UpsertOutcome } from '@/lib/geo-cms';

/**
 * POST /api/admin/news/import
 *
 * Backfill: read the legacy markdown guides (content/geo/**) and upsert them
 * into geo_articles, keyed by slug, as source='pipeline'. Admin-authored rows
 * (source='manual') are left untouched. Admin-gated.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { ok: false as const, error: 'Forbidden', status: 403 as const };
  return { ok: true as const, user };
}

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const guides = listLegacyFileGuides();
  const tally: Record<UpsertOutcome, number> = { created: 0, updated: 0, skipped: 0 };
  const errors: string[] = [];

  for (const guide of guides) {
    try {
      const outcome = await upsertArticleBySlug(
        {
          slug: guide.slug,
          title: guide.title,
          description: guide.description ?? null,
          excerpt: guide.excerpt ?? null,
          key_takeaway: guide.keyTakeaway ?? null,
          body: guide.content,
          topic: guide.topic,
          tags: guide.tags,
          hero_image: guide.heroImage ?? null,
          hero_image_style: guide.heroImageStyle ?? null,
          reading_time_minutes: guide.readingTimeMinutes,
          meta: (guide.metadata as Record<string, unknown>) ?? {},
          status: guide.status,
        },
        'pipeline',
      );
      tally[outcome] += 1;
    } catch (err) {
      errors.push(`${guide.slug}: ${(err as Error).message}`);
    }
  }

  revalidatePath('/news');

  return NextResponse.json({ total: guides.length, ...tally, errors });
}
