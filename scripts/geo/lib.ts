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
