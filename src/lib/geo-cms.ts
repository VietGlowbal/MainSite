import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-only data access for the GEO News CMS.
 *
 * Writes (and admin reads of drafts) go through the Supabase service-role
 * client so they bypass row-level security — the calling code is responsible
 * for verifying the caller is an admin first (see requireAdmin in the
 * /api/admin/news routes). Never import this module into a client component:
 * it reads SUPABASE_SERVICE_ROLE_KEY.
 *
 * The public site read path (/news, /guides/[slug]) is migrated to the DB in a
 * later phase — see GEO_CMS_SPEC.md. Until then this powers the admin CMS only.
 */

export type GeoArticleStatus = 'draft' | 'published' | 'archived';
export type GeoArticleSource = 'manual' | 'pipeline';

export type GeoArticle = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  key_takeaway: string | null;
  body: string;
  topic: string;
  tags: string[];
  hero_image: string | null;
  hero_image_style: 'ai' | 'svg-fallback' | null;
  reading_time_minutes: number | null;
  meta: Record<string, unknown>;
  status: GeoArticleStatus;
  source: GeoArticleSource;
  pipeline_cluster_id: string | null;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields an admin (or the pipeline) may set when creating/updating an article. */
export type GeoArticleInput = {
  slug?: string;
  title?: string;
  description?: string | null;
  excerpt?: string | null;
  key_takeaway?: string | null;
  body?: string;
  topic?: string;
  tags?: string[];
  hero_image?: string | null;
  hero_image_style?: 'ai' | 'svg-fallback' | null;
  reading_time_minutes?: number | null;
  meta?: Record<string, unknown>;
  status?: GeoArticleStatus;
};

const TABLE = 'geo_articles';

/** url-friendly slug derived from a title. Mirrors the pipeline's slugs. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (đ/Đ handled below)
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

/** ~180 wpm, floored at 4 minutes — matches src/lib/geo-content.ts. */
export function estimateReadMinutes(body: string): number {
  return Math.max(4, Math.round(body.split(/\s+/).filter(Boolean).length / 180));
}

/** List articles for the admin console (all statuses), newest first. */
export async function listArticlesForAdmin(): Promise<GeoArticle[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GeoArticle[];
}

export async function getArticleById(id: string): Promise<GeoArticle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GeoArticle) ?? null;
}

export async function createArticle(input: GeoArticleInput, authorId: string | null): Promise<GeoArticle> {
  const title = (input.title ?? '').trim();
  if (!title) throw new Error('Title is required');

  const slug = (input.slug?.trim() || slugify(title));
  if (!slug) throw new Error('Could not derive a slug — set one manually');

  const body = input.body ?? '';
  const row = {
    slug,
    title,
    description: input.description ?? null,
    excerpt: input.excerpt ?? null,
    key_takeaway: input.key_takeaway ?? null,
    body,
    topic: input.topic?.trim() || 'All topics',
    tags: input.tags ?? [],
    hero_image: input.hero_image ?? null,
    hero_image_style: input.hero_image_style ?? null,
    reading_time_minutes: input.reading_time_minutes ?? estimateReadMinutes(body),
    meta: input.meta ?? {},
    status: input.status ?? 'draft',
    source: 'manual' as GeoArticleSource,
    author_id: authorId,
    // published_at is stamped by the trigger when status flips to published,
    // but on direct insert-as-published we set it here too.
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  };

  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE).insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw new Error(`An article with slug "${slug}" already exists`);
    throw new Error(error.message);
  }
  return data as GeoArticle;
}

export async function updateArticle(id: string, input: GeoArticleInput): Promise<GeoArticle> {
  const patch: Record<string, unknown> = {};
  // Only assign provided keys so a partial PATCH never nulls untouched fields.
  for (const key of [
    'slug', 'title', 'description', 'excerpt', 'key_takeaway', 'body',
    'topic', 'tags', 'hero_image', 'hero_image_style', 'reading_time_minutes',
    'meta', 'status',
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (typeof patch.title === 'string') patch.title = patch.title.trim();
  if (typeof patch.slug === 'string') patch.slug = patch.slug.trim();
  // Recompute the reading estimate if the body changed and no explicit value
  // was supplied.
  if (typeof input.body === 'string' && input.reading_time_minutes === undefined) {
    patch.reading_time_minutes = estimateReadMinutes(input.body);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE).update(patch).eq('id', id).select('*').single();
  if (error) {
    if (error.code === '23505') throw new Error(`That slug is already in use by another article`);
    throw new Error(error.message);
  }
  return data as GeoArticle;
}

export async function deleteArticle(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Article-to-article links (the GEO graph) ─────────────────────────────────
export type GeoLinkRelation = 'related' | 'cluster' | 'prerequisite' | 'next' | 'cites';
export const GEO_LINK_RELATIONS: GeoLinkRelation[] = ['related', 'cluster', 'prerequisite', 'next', 'cites'];

export type GeoArticleLink = {
  to_article_id: string;
  relation: GeoLinkRelation;
  weight: number;
};

/** Outgoing edges from one article, strongest first. */
export async function listLinksForArticle(fromId: string): Promise<GeoArticleLink[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('geo_article_links')
    .select('to_article_id, relation, weight')
    .eq('from_article_id', fromId)
    .order('weight', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GeoArticleLink[];
}

/** Replace the full set of outgoing edges for an article (delete + insert). */
export async function replaceArticleLinks(fromId: string, links: GeoArticleLink[]): Promise<void> {
  const admin = createAdminClient();
  const { error: delErr } = await admin.from('geo_article_links').delete().eq('from_article_id', fromId);
  if (delErr) throw new Error(delErr.message);

  // De-dupe by (to, relation), drop self-links, default weight.
  const seen = new Set<string>();
  const rows = links
    .filter((l) => l.to_article_id && l.to_article_id !== fromId)
    .filter((l) => {
      const key = `${l.to_article_id}:${l.relation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((l) => ({
      from_article_id: fromId,
      to_article_id: l.to_article_id,
      relation: l.relation,
      weight: Number.isFinite(l.weight) ? l.weight : 0,
    }));

  if (rows.length) {
    const { error } = await admin.from('geo_article_links').insert(rows);
    if (error) throw new Error(error.message);
  }
}

export type UpsertOutcome = 'created' | 'updated' | 'skipped';

/**
 * Insert or update an article keyed by slug. Used by the file backfill and
 * (later) the GEO pipeline. A row that an admin has authored/edited
 * (source='manual') is never clobbered by an automated upsert — those return
 * 'skipped' so human edits always win.
 */
export async function upsertArticleBySlug(
  input: GeoArticleInput & { slug: string },
  source: GeoArticleSource,
): Promise<UpsertOutcome> {
  const admin = createAdminClient();
  const { data: existing, error: lookupErr } = await admin
    .from(TABLE)
    .select('id, source')
    .eq('slug', input.slug)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);

  const body = input.body ?? '';
  const fields = {
    title: (input.title ?? input.slug).trim(),
    description: input.description ?? null,
    excerpt: input.excerpt ?? null,
    key_takeaway: input.key_takeaway ?? null,
    body,
    topic: input.topic?.trim() || 'All topics',
    tags: input.tags ?? [],
    hero_image: input.hero_image ?? null,
    hero_image_style: input.hero_image_style ?? null,
    reading_time_minutes: input.reading_time_minutes ?? estimateReadMinutes(body),
    meta: input.meta ?? {},
    status: input.status ?? 'draft',
  };

  if (existing) {
    // Don't overwrite an admin's manual work with an automated import.
    if ((existing as { source: GeoArticleSource }).source === 'manual') return 'skipped';
    const { error } = await admin.from(TABLE).update(fields).eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message);
    return 'updated';
  }

  const { error } = await admin.from(TABLE).insert({
    slug: input.slug,
    source,
    published_at: fields.status === 'published' ? new Date().toISOString() : null,
    ...fields,
  });
  if (error) throw new Error(error.message);
  return 'created';
}
