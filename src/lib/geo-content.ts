import fs from 'node:fs';
import path from 'node:path';

export type GeoGuide = {
  slug: string;
  title: string;
  description?: string;
  content: string;
  status: 'draft' | 'published';
  metadata?: Record<string, unknown>;
};

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot, 'content/geo/drafts');
const publishedDir = path.join(repoRoot, 'content/geo/published');
const metadataDir = path.join(repoRoot, 'content/geo/metadata');

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

function readGuideFromFile(filePath: string, status: 'draft' | 'published'): GeoGuide {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const slug = frontmatter.slug || path.basename(filePath, '.md');
  return {
    slug,
    title: frontmatter.title || slug,
    description: frontmatter.description,
    content: body,
    status,
    metadata: readMetadata(slug),
  };
}

export function listGeoGuides() {
  const guides: GeoGuide[] = [];
  for (const [dirPath, status] of [[publishedDir, 'published'], [draftsDir, 'draft']] as const) {
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (file.endsWith('.md')) guides.push(readGuideFromFile(path.join(dirPath, file), status));
    }
  }
  return guides;
}

export function getGeoGuide(slug: string) {
  const publishedPath = path.join(publishedDir, `${slug}.md`);
  if (fs.existsSync(publishedPath)) return readGuideFromFile(publishedPath, 'published');
  const draftPath = path.join(draftsDir, `${slug}.md`);
  if (fs.existsSync(draftPath)) return readGuideFromFile(draftPath, 'draft');
  return null;
}
