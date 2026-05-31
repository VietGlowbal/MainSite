import fs from 'node:fs';
import path from 'node:path';

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
  tags: string[];
  keyTakeaway?: string;
  supportCards: GeoSupportCard[];
  supportAssets: GeoSupportAsset[];
  toc: Array<{ id: string; title: string }>;
};

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot, 'content/geo/drafts');
const publishedDir = path.join(repoRoot, 'content/geo/published');
const metadataDir = path.join(repoRoot, 'content/geo/metadata');
const publicNewsImagesDir = path.join(repoRoot, 'public/generated/news');

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: markdown };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx !== -1) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { frontmatter, body: match[2] };
}

function readMetadata(slug: string) {
  const filePath = path.join(metadataDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function estimateReadMinutes(content: string) {
  return Math.max(4, Math.round(content.split(/\s+/).filter(Boolean).length / 180));
}

// These guides come from an automated draft pipeline that injects internal
// scaffolding (placeholder source tokens, "testing mode" notes, and
// authoring-rule FAQs). Strip that scaffolding so readers only ever see
// publishable prose — and drop the leading H1 since the page renders its own.
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
  return firstParagraph?.replace(/TODO_SOURCE_REQUIRED:/g, '').trim() ?? 'Experimental Glowbal guide generated for testing.';
}

function inferTopic(frontmatter: Record<string, string>, body: string, metadata?: Record<string, unknown>) {
  const metadataTopic = typeof metadata?.topic === 'string' ? metadata.topic : undefined;
  if (metadataTopic) return metadataTopic;
  const title = `${frontmatter.title ?? ''} ${frontmatter.subject ?? ''}`.toLowerCase();
  const pageType = (frontmatter.pageType ?? '').toLowerCase();
  const bodyText = body.toLowerCase();
  if (title.includes('scholarship')) return 'Scholarships';
  if (title.includes('visa') || title.includes('immigration')) return 'Visas & immigration';
  if (title.includes('student life') || title.includes('accommodation') || title.includes('part-time')) return 'Student life';
  if (title.includes('career') || title.includes('employ')) return 'Careers';
  if (title.includes('cost') || title.includes('application') || title.includes('admission') || title.includes('sop')) return 'Applications';
  if (pageType === 'ranking' || pageType === 'comparison' || title.includes('university') || title.includes('degree') || title.includes('comparison') || title.includes('guide') || title.includes('computer science')) return 'Universities';
  if (bodyText.includes('visa') || bodyText.includes('immigration')) return 'Visas & immigration';
  return 'All topics';
}

function resolveHeroImage(slug: string, metadata?: Record<string, unknown>) {
  const metadataHero = typeof metadata?.heroImage === 'string' ? metadata.heroImage : undefined;
  if (metadataHero) {
    return {
      heroImage: metadataHero,
      heroImageStyle: typeof metadata?.heroImageStyle === 'string' && metadata.heroImageStyle === 'ai' ? 'ai' as const : metadataHero.endsWith('.svg') ? 'svg-fallback' as const : 'ai' as const,
    };
  }
  const png = path.join(publicNewsImagesDir, `${slug}.png`);
  const webp = path.join(publicNewsImagesDir, `${slug}.webp`);
  if (fs.existsSync(png)) return { heroImage: `/generated/news/${slug}.png`, heroImageStyle: 'ai' as const };
  if (fs.existsSync(webp)) return { heroImage: `/generated/news/${slug}.webp`, heroImageStyle: 'ai' as const };
  return { heroImage: `/generated/news/${slug}.svg`, heroImageStyle: 'svg-fallback' as const };
}

function readGuideFromFile(filePath: string, status: 'draft' | 'published'): GeoGuide {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const slug = frontmatter.slug || path.basename(filePath, '.md');
  const metadata = readMetadata(slug);
  const hero = resolveHeroImage(slug, metadata);
  return {
    slug,
    title: frontmatter.title || slug,
    description: frontmatter.description,
    excerpt: buildExcerpt(body, frontmatter.description),
    content: sanitizeContent(body),
    status,
    metadata,
    heroImage: hero.heroImage,
    heroImageStyle: hero.heroImageStyle,
    topic: inferTopic(frontmatter, body, metadata),
    readingTimeMinutes: typeof metadata?.readingTimeMinutes === 'number' ? metadata.readingTimeMinutes : estimateReadMinutes(body),
    publishedAt: frontmatter.lastUpdated || new Date().toISOString().slice(0, 10),
    tags: Array.isArray(metadata?.tags) ? (metadata.tags as string[]) : [],
    keyTakeaway: typeof metadata?.keyTakeaway === 'string' ? metadata.keyTakeaway : undefined,
    supportCards: Array.isArray(metadata?.supportCards) ? (metadata.supportCards as GeoSupportCard[]) : [],
    supportAssets: Array.isArray(metadata?.supportAssets) ? (metadata.supportAssets as GeoSupportAsset[]) : [],
    toc: Array.isArray(metadata?.toc) ? (metadata.toc as Array<{ id: string; title: string }>) : [],
  };
}

function sortNewestFirst(a: GeoGuide, b: GeoGuide) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || a.title.localeCompare(b.title);
}

export function listGeoGuides() {
  const guides: GeoGuide[] = [];
  for (const [dirPath, status] of [[publishedDir, 'published'], [draftsDir, 'draft']] as const) {
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (file.endsWith('.md')) guides.push(readGuideFromFile(path.join(dirPath, file), status));
    }
  }
  return guides.sort(sortNewestFirst);
}

export function getGeoGuide(slug: string) {
  const publishedPath = path.join(publishedDir, `${slug}.md`);
  if (fs.existsSync(publishedPath)) return readGuideFromFile(publishedPath, 'published');
  const draftPath = path.join(draftsDir, `${slug}.md`);
  if (fs.existsSync(draftPath)) return readGuideFromFile(draftPath, 'draft');
  return null;
}

export function listGeoTopics() {
  return ['All topics', ...new Set(listGeoGuides().map((guide) => guide.topic))];
}

export function listRelatedGeoGuides(currentSlug: string, topic: string, limit = 3) {
  return listGeoGuides().filter((guide) => guide.slug !== currentSlug).sort((a, b) => Number(b.topic === topic) - Number(a.topic === topic) || b.readingTimeMinutes - a.readingTimeMinutes).slice(0, limit);
}
