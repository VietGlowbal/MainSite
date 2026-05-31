import fs from 'node:fs';
import path from 'node:path';
import type { DraftManifest, GeoConfig, GeoPageMetadata, GeoQualityCheck, GeoSource, StudentQuestion, TopicCluster } from './types';

const repoRoot = process.cwd();

export const paths = {
  repoRoot,
  config: path.join(repoRoot, 'data/geo/config.json'),
  questions: path.join(repoRoot, 'data/geo/student-questions.json'),
  clusters: path.join(repoRoot, 'data/geo/topic-clusters.json'),
  sources: path.join(repoRoot, 'data/geo/sources.json'),
  draftsDir: path.join(repoRoot, 'content/geo/drafts'),
  publishedDir: path.join(repoRoot, 'content/geo/published'),
  metadataDir: path.join(repoRoot, 'content/geo/metadata'),
  reportsDir: path.join(repoRoot, 'content/geo/reports'),
  manifest: path.join(repoRoot, 'content/geo/reports/draft-manifest.json'),
  qualityDir: path.join(repoRoot, 'content/geo/reports/quality'),
  templatesDir: path.join(repoRoot, 'templates/geo'),
  publicNewsImagesDir: path.join(repoRoot, 'public/generated/news'),
  publicSupportDir: path.join(repoRoot, 'public/generated/news/support'),
};

const defaultConfig: GeoConfig = {
  mode: 'testing',
  questionsPerRun: 10,
  draftPagesPerRun: 5,
  allowMultipleOpenGeoPRs: true,
  requireHumanReview: true,
  autoMerge: false,
  allowGenericDrafts: true,
  requireSourcesForPublishable: false,
  directPublishToSite: true,
};

export function ensureDir(dirPath: string) { fs.mkdirSync(dirPath, { recursive: true }); }
export function nowIso() { return new Date().toISOString(); }
export function todayDateString() { return nowIso().slice(0, 10); }
export function timestampSlug(date = new Date()) { const p = (v:number)=>String(v).padStart(2,'0'); return `${date.getUTCFullYear()}-${p(date.getUTCMonth()+1)}-${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}`; }
export function timestampDisplay(date = new Date()) { const p = (v:number)=>String(v).padStart(2,'0'); return `${date.getUTCFullYear()}-${p(date.getUTCMonth()+1)}-${p(date.getUTCDate())} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`; }
export function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-'); }
export function stableId(prefix: string, input: string) { const normalized = slugify(input).slice(0, 48) || 'item'; return `${prefix}-${normalized}`; }
export function readJsonFile<T>(filePath: string, fallback: T): T { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) as T : fallback; }
export function writeJsonFile(filePath: string, value: unknown) { ensureDir(path.dirname(filePath)); fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
export function readConfig() { return { ...defaultConfig, ...readJsonFile<Partial<GeoConfig>>(paths.config, {}) } as GeoConfig; }
export function readQuestions() { return readJsonFile<StudentQuestion[]>(paths.questions, []); }
export function writeQuestions(questions: StudentQuestion[]) { writeJsonFile(paths.questions, questions); }
export function readClusters() { return readJsonFile<TopicCluster[]>(paths.clusters, []); }
export function writeClusters(clusters: TopicCluster[]) { writeJsonFile(paths.clusters, clusters); }
export function readSources() { return readJsonFile<GeoSource[]>(paths.sources, []); }
export function writeSources(sources: GeoSource[]) { writeJsonFile(paths.sources, sources); }
export function readManifest() { return readJsonFile<DraftManifest[]>(paths.manifest, []); }
export function writeManifest(manifest: DraftManifest[]) { writeJsonFile(paths.manifest, manifest); }
export function writeMarkdown(filePath: string, markdown: string) { ensureDir(path.dirname(filePath)); fs.writeFileSync(filePath, markdown, 'utf8'); }
export function readMarkdown(filePath: string) { return fs.readFileSync(filePath, 'utf8'); }
export function loadTemplate(pageType: 'ranking' | 'comparison' | 'guide') { return fs.readFileSync(path.join(paths.templatesDir, `${pageType}Page.md`), 'utf8'); }
export function fillTemplate(template: string, replacements: Record<string, string>) { let out = template; for (const [k,v] of Object.entries(replacements)) out = out.replaceAll(`{{${k}}}`, v); return out; }
export function parseFrontmatter(markdown: string) { const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!match) return { frontmatter: {}, body: markdown }; const frontmatter: Record<string,string> = {}; for (const line of match[1].split('\n')) { const idx = line.indexOf(':'); if (idx !== -1) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim(); } return { frontmatter, body: match[2] }; }
export function walk(dirPath: string, visit: (filePath: string) => void) { for (const entry of fs.readdirSync(dirPath,{withFileTypes:true})) { const full = path.join(dirPath, entry.name); if (entry.isDirectory()) walk(full, visit); else visit(full); } }
export function listExistingPageSlugs() { const slugs = new Set<string>(); for (const base of [path.join(repoRoot,'src/app'), paths.draftsDir, paths.publishedDir]) { if (!fs.existsSync(base)) continue; walk(base, (filePath) => { const relative = path.relative(base, filePath).replace(/\\/g,'/'); if (relative.endsWith('/page.tsx')) { const slug = relative.replace(/\/page\.tsx$/, ''); if (slug) slugs.add(slug); } if (relative.endsWith('.md')) slugs.add(path.basename(relative, '.md')); }); } return slugs; }
export function cosineLikeSimilarity(a: string, b: string) { const tokens = (value:string)=>new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((t)=>t.length>2)); const aT=tokens(a); const bT=tokens(b); const i=[...aT].filter((t)=>bT.has(t)).length; return i/Math.max(aT.size+bT.size-i,1); }
export function scoreAverage(checks: GeoQualityCheck[]) { return checks.length ? Math.round(checks.reduce((sum, item) => sum + item.score, 0) / checks.length) : 0; }
export function readQualityChecks() { return !fs.existsSync(paths.qualityDir) ? [] as GeoQualityCheck[] : fs.readdirSync(paths.qualityDir).filter((f)=>f.endsWith('.json')).map((f)=>readJsonFile<GeoQualityCheck>(path.join(paths.qualityDir,f), {} as GeoQualityCheck)).filter((x)=>x.slug); }
export function readMetadataFiles() { return !fs.existsSync(paths.metadataDir) ? [] as GeoPageMetadata[] : fs.readdirSync(paths.metadataDir).filter((f)=>f.endsWith('.json')).map((f)=>readJsonFile<GeoPageMetadata>(path.join(paths.metadataDir,f), {} as GeoPageMetadata)).filter((x)=>x.slug); }
export function sourcesForSlug(slug: string) { return readSources().filter((source) => source.relatedSlug === slug); }
export function estimateReadMinutes(content: string) { return Math.max(4, Math.round(content.split(/\s+/).filter(Boolean).length / 180)); }
export function inferTopic(frontmatter: Record<string, string>, body: string) {
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
export function buildHeroImagePrompt(frontmatter: Record<string, string>, topic: string) {
  const title = frontmatter.title ?? 'Glowbal study abroad guide';
  const country = frontmatter.targetCountry && frontmatter.targetCountry !== 'Multi-country' ? frontmatter.targetCountry : 'international';
  const studentSegment = frontmatter.studentSegment ?? 'international students';
  return `Editorial hero image for a study abroad news article titled "${title}". Show ${studentSegment} exploring ${country} higher education themes. Include visual cues for ${topic.toLowerCase()}, academic ambition, international study, and premium but trustworthy education guidance. Clean modern magazine style, bright natural lighting, polished realistic illustration, no text, no watermark.`;
}
export function buildSupportVisualPrompt(title: string, label: string, topic: string) {
  return `Supporting visual asset for the Glowbal article "${title}". Create a clean premium editorial ${label.toLowerCase()} about ${topic.toLowerCase()}, suitable for UI cards and article support visuals. No text, no watermark, simple modern brand language.`;
}
export function writeFallbackNewsImage(slug: string, title: string, topic: string, country?: string) {
  ensureDir(paths.publicNewsImagesDir);
  const safeTitle = escapeXml(title);
  const safeTopic = escapeXml(topic);
  const safeCountry = escapeXml(country && country !== 'Multi-country' ? country : 'Global');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff2f8"/>
      <stop offset="45%" stop-color="#eef6ff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff4d8c"/>
      <stop offset="50%" stop-color="#00c8e6"/>
      <stop offset="100%" stop-color="#1e2a78"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#1e2a78" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1230" cy="180" r="140" fill="#dff5ff"/>
  <circle cx="1350" cy="670" r="220" fill="#ffe7f1"/>
  <circle cx="230" cy="130" r="120" fill="#eef2ff"/>
  <g opacity="0.95" filter="url(#shadow)">
    <rect x="92" y="110" width="1416" height="680" rx="40" fill="white"/>
  </g>
  <rect x="130" y="150" width="610" height="600" rx="34" fill="url(#accent)" opacity="0.96"/>
  <circle cx="435" cy="430" r="156" fill="white" opacity="0.15"/>
  <circle cx="435" cy="430" r="116" fill="white" opacity="0.18"/>
  <path d="M435 286C502 286 556 340 556 407C556 474 502 528 435 528C368 528 314 474 314 407C314 340 368 286 435 286Z" fill="white" opacity="0.24"/>
  <path d="M435 282C474 282 512 295 542 319C522 316 507 321 494 332C475 347 463 376 433 389C406 401 369 396 346 412C332 422 323 439 321 461C316 445 314 426 314 407C314 338 368 282 435 282Z" fill="white" opacity="0.65"/>
  <path d="M455 531C477 520 503 503 520 480C545 448 550 408 541 372C561 392 573 419 573 449C573 518 517 574 448 574C410 574 375 557 351 531C379 542 424 545 455 531Z" fill="white" opacity="0.52"/>
  <rect x="804" y="186" width="166" height="40" rx="20" fill="#ffe1ee"/>
  <text x="887" y="211" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ff4d8c">GLOWBAL NEWS</text>
  <text x="804" y="300" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="#16213e">${safeTitle}</text>
  <text x="804" y="386" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#425466">${safeTopic}</text>
  <text x="804" y="432" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="#5b6b82">Destination: ${safeCountry}</text>
  <text x="804" y="476" font-family="Arial, sans-serif" font-size="22" font-weight="400" fill="#6b7280">Automated study-abroad guide artwork generated for the Glowbal News feed.</text>
  <rect x="804" y="548" width="286" height="62" rx="31" fill="url(#accent)"/>
  <text x="947" y="587" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="white">Read full guide</text>
</svg>`;
  fs.writeFileSync(path.join(paths.publicNewsImagesDir, `${slug}.svg`), svg, 'utf8');
}
export function writeSupportAssetSvg(slug: string, key: string, label: string, topic: string, accent: string, glyph: string) {
  ensureDir(path.join(paths.publicSupportDir, slug));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="64" fill="#ffffff"/>
  <rect x="20" y="20" width="216" height="216" rx="52" fill="url(#grad)"/>
  <circle cx="128" cy="116" r="58" fill="#ffffff" fill-opacity="0.92"/>
  <text x="128" y="136" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#1e2a78">${escapeXml(glyph)}</text>
  <text x="128" y="188" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1e2a78">${escapeXml(label)}</text>
  <text x="128" y="212" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="500" fill="#54627a">${escapeXml(topic)}</text>
</svg>`;
  fs.writeFileSync(path.join(paths.publicSupportDir, slug, `${key}.svg`), svg, 'utf8');
}
function escapeXml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
