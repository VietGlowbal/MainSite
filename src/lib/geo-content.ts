import { createAdminClient } from '@/lib/supabase/admin';
import { hasPlaceholderPublicationQuality } from '@/lib/geo-cms-validation';

export type GeoSupportCard = {
  title: string;
  description: string;
  icon: string;
  accent: 'pink' | 'cyan' | 'violet' | 'amber' | 'emerald';
};

export type GeoSupportAsset = {
  kind: 'icon' | 'badge' | 'illustration';
  label: string;
  assetPath: string;
  prompt: string;
};

export type GeoGuide = {
  slug: string;
  title: string;
  description?: string;
  excerpt: string;
  content: string;
  status: 'draft' | 'published';
  metadata?: Record<string, unknown>;
  heroImage: string;
  heroImageStyle: 'ai' | 'svg-fallback';
  topic: string;
  readingTimeMinutes: number;
  publishedAt: string;
  /** Last content update when the source exposes one (DB rows do; ISO date or datetime). */
  updatedAt?: string;
  tags: string[];
  keyTakeaway?: string;
  supportCards: GeoSupportCard[];
  supportAssets: GeoSupportAsset[];
  toc: Array<{ id: string; title: string }>;
};

/*
 * `geo_articles` is the only source of /news content. The markdown generator
 * that used to fill content/geo/** — and the daily workflow that committed its
 * output to main — were removed on 2026-09-20 (owner's call: the seeded pages
 * were AI drafts that never reached `published`, so nothing reader-facing was
 * lost). Everything below reads the CMS.
 */

/**
 * Cover shown when a row carries no `hero_image`. The list and article
 * templates render <Image src={guide.heroImage}> unconditionally, so this must
 * stay a real, servable path — an empty string throws in next/image.
 */
const PLACEHOLDER_HERO = '/news/placeholder-cover.svg';

function estimateReadMinutes(content: string) {
  return Math.max(4, Math.round(content.split(/\s+/).filter(Boolean).length / 180));
}

// Rows imported from the retired draft pipeline still carry its internal
// scaffolding (placeholder source tokens, "testing mode" notes, authoring-rule
// FAQs). Strip that scaffolding so readers only ever see publishable prose —
// and drop the leading H1 since the page renders its own. Admin-authored rows
// contain none of these markers, so this is a no-op for them.
function sanitizeContent(body: string) {
  let text = body;
  // Remove the leading H1 (duplicates the page title rendered above the body).
  text = text.replace(/^\s*#\s+.*\n/, '');
  // Remove internal "testing mode" meta-commentary.
  text = text.replace(/\s*In testing mode, some drafts may still be generic and will need human review before anything publishable happens\./g, '');
  // Remove internal authoring-rule FAQ pairs (heading + answer up to the next heading).
  text = text.replace(/#{2,3}\s*Can this draft include unknown facts\?[\s\S]*?(?=\n#{2,3}\s|\n*$)/g, '');
  text = text.replace(/#{2,3}\s*Can this be published live during testing\?[\s\S]*?(?=\n#{2,3}\s|\n*$)/g, '');
  // Strip placeholder source tokens — whole bullet lines first, then inline fragments.
  text = text.replace(/^\s*[-*]\s*TODO_SOURCE_REQUIRED:.*$/gm, '');
  text = text.replace(/\s*TODO_SOURCE_REQUIRED:[^\n|]*/g, '');
  text = text.replace(/TODO_SOURCE_REQUIRED/g, '');
  // If the Sources section ended up empty, leave a neutral note instead of a bare heading.
  text = text.replace(/(#{2}\s*Sources\s*\n)(?:\s*\n)*(?=#{2}\s|$)/g, '$1Official sources are being verified and will be added here.\n\n');
  // Light proper-noun fix the generator lowercases.
  text = text.replace(/\bvietnamese\b/g, 'Vietnamese');
  // Collapse excess blank lines left by removals.
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function buildExcerpt(body: string, description?: string) {
  if (description) return description;
  const firstParagraph = body.split('\n').find((line) => line.trim() && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('- '));
  return firstParagraph?.replace(/TODO_SOURCE_REQUIRED:/g, '').trim() ?? '';
}

function sortNewestFirst(a: GeoGuide, b: GeoGuide) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || a.title.localeCompare(b.title);
}

// ── DB-backed readers (the CMS is the only source) ──────────────────────────
// We surface only PUBLISHED rows to the public site. Any failure (no env at
// build time, table not migrated yet) degrades gracefully to an empty list so
// the site — and `next build` without Supabase env — keep working.

type GeoArticleRow = {
  slug: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  key_takeaway: string | null;
  body: string;
  topic: string;
  tags: string[] | null;
  hero_image: string | null;
  hero_image_style: 'ai' | 'svg-fallback' | null;
  reading_time_minutes: number | null;
  meta: Record<string, unknown> | null;
  published_at: string | null;
  updated_at: string;
};

function resolveHeroImage(row: GeoArticleRow, metadata?: Record<string, unknown>) {
  const stored = row.hero_image || (typeof metadata?.heroImage === 'string' ? metadata.heroImage : undefined);
  if (!stored) return { heroImage: PLACEHOLDER_HERO, heroImageStyle: 'svg-fallback' as const };
  return {
    heroImage: stored,
    heroImageStyle: row.hero_image_style ?? (stored.endsWith('.svg') ? 'svg-fallback' as const : 'ai' as const),
  };
}

function mapRowToGuide(row: GeoArticleRow): GeoGuide {
  const metadata = row.meta ?? undefined;
  const body = sanitizeContent(row.body ?? '');
  const hero = resolveHeroImage(row, metadata);
  return {
    slug: row.slug,
    title: row.title || row.slug,
    description: row.description ?? undefined,
    excerpt: row.excerpt || buildExcerpt(row.body ?? '', row.description ?? undefined),
    content: body,
    status: 'published',
    metadata,
    heroImage: hero.heroImage,
    heroImageStyle: hero.heroImageStyle,
    topic: row.topic || 'All topics',
    readingTimeMinutes: row.reading_time_minutes ?? estimateReadMinutes(row.body ?? ''),
    publishedAt: (row.published_at ?? row.updated_at).slice(0, 10),
    updatedAt: row.updated_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
    keyTakeaway: row.key_takeaway ?? undefined,
    supportCards: Array.isArray(metadata?.supportCards) ? (metadata!.supportCards as GeoSupportCard[]) : [],
    supportAssets: Array.isArray(metadata?.supportAssets) ? (metadata!.supportAssets as GeoSupportAsset[]) : [],
    toc: Array.isArray(metadata?.toc) ? (metadata!.toc as Array<{ id: string; title: string }>) : [],
  };
}

const ARTICLE_COLUMNS =
  'slug, title, description, excerpt, key_takeaway, body, topic, tags, hero_image, hero_image_style, reading_time_minutes, meta, published_at, updated_at';

/**
 * The publication-quality gate applied at the public-read boundary. A stored
 * `published` row that still carries generator placeholder copy (or a
 * TODO_SOURCE_REQUIRED marker sanitisation would paper over) must never reach
 * /news or the sitemap — measured live 2026-08-25: two `published` pipeline
 * rows shipped "A Glowbal draft guide …" descriptions. Those rows outlived the
 * generator that wrote them, so the gate stays. This is read-side defence
 * only; the admin publish transition enforces the same rules upstream.
 */
function rowIsPubliclyReadable(row: GeoArticleRow): boolean {
  return hasPlaceholderPublicationQuality({
    title: row.title,
    description: row.description,
    excerpt: row.excerpt,
    body: row.body,
  });
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function listGeoGuides(): Promise<GeoGuide[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('geo_articles')
      .select(ARTICLE_COLUMNS)
      .eq('status', 'published');
    if (error || !data) return [];
    return (data as GeoArticleRow[])
      .filter(rowIsPubliclyReadable)
      .map(mapRowToGuide)
      .sort(sortNewestFirst);
  } catch {
    return [];
  }
}

export async function getGeoGuide(slug: string): Promise<GeoGuide | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('geo_articles')
      .select(ARTICLE_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error || !data) return null;
    const row = data as GeoArticleRow;
    if (!rowIsPubliclyReadable(row)) return null;
    return mapRowToGuide(row);
  } catch {
    return null;
  }
}

export async function listGeoTopics(): Promise<string[]> {
  const guides = await listGeoGuides();
  return ['All topics', ...new Set(guides.map((guide) => guide.topic))];
}

/**
 * Related guides drawn from the explicit GEO graph (geo_article_links) rather
 * than the topic heuristic. Returns published targets in link-weight order.
 * Empty array on any miss so callers can fall back to the heuristic.
 */
export async function listLinkedPublishedGuides(
  slug: string,
  relations: Array<'related' | 'cluster' | 'prerequisite' | 'next' | 'cites'>,
  limit = 3,
): Promise<GeoGuide[]> {
  try {
    const admin = createAdminClient();
    const { data: fromRow } = await admin
      .from('geo_articles')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (!fromRow) return [];

    let query = admin
      .from('geo_article_links')
      .select('to_article_id, relation, weight')
      .eq('from_article_id', (fromRow as { id: string }).id);
    if (relations.length) query = query.in('relation', relations);
    const { data: links } = await query.order('weight', { ascending: false });
    if (!links?.length) return [];

    const toIds = (links as Array<{ to_article_id: string }>).map((l) => l.to_article_id);
    const { data: targets } = await admin
      .from('geo_articles')
      .select(`id, ${ARTICLE_COLUMNS}`)
      .in('id', toIds)
      .eq('status', 'published');
    if (!targets?.length) return [];

    const byId = new Map<string, GeoGuide>();
    for (const row of targets as Array<GeoArticleRow & { id: string }>) {
      // Related rails render on public article pages, so the same gate applies.
      if (!rowIsPubliclyReadable(row)) continue;
      byId.set(row.id, mapRowToGuide(row));
    }
    // Preserve the link (weight) ordering.
    const ordered: GeoGuide[] = [];
    for (const link of links as Array<{ to_article_id: string }>) {
      const guide = byId.get(link.to_article_id);
      if (guide && !ordered.includes(guide)) ordered.push(guide);
    }
    return ordered.slice(0, limit);
  } catch {
    return [];
  }
}

export async function listRelatedGeoGuides(currentSlug: string, topic: string, limit = 3): Promise<GeoGuide[]> {
  const guides = await listGeoGuides();
  return guides
    .filter((guide) => guide.slug !== currentSlug)
    .sort((a, b) => Number(b.topic === topic) - Number(a.topic === topic) || b.readingTimeMinutes - a.readingTimeMinutes)
    .slice(0, limit);
}
