import fs from 'node:fs';
import path from 'node:path';
import { buildHeroImagePrompt, buildSupportVisualPrompt, ensureDir, inferTopic, parseFrontmatter, paths, readMarkdown, writeFallbackNewsImage, writeJsonFile, writeSupportAssetSvg } from './lib';

type ImageEntry = {
  slug: string;
  title: string;
  topic: string;
  prompt: string;
  imagePath: string;
  imageStyle: 'svg-fallback' | 'ai';
  supportAssets: Array<{ kind: 'icon' | 'badge' | 'illustration'; label: string; assetPath: string; prompt: string }>;
};

const supportTemplates = {
  Universities: [
    { key: 'global-recognition', label: 'Global recognition', glyph: '✦', accent: '#7c3aed' },
    { key: 'career-outcomes', label: 'Career outcomes', glyph: '↗', accent: '#00b4d8' },
    { key: 'innovation', label: 'Innovation', glyph: '⌘', accent: '#ff4d8c' },
  ],
  Applications: [
    { key: 'planning', label: 'Planning', glyph: '✓', accent: '#ff4d8c' },
    { key: 'documents', label: 'Documents', glyph: '☰', accent: '#00b4d8' },
    { key: 'deadlines', label: 'Deadlines', glyph: '◷', accent: '#7c3aed' },
  ],
  Scholarships: [
    { key: 'funding', label: 'Funding', glyph: '£', accent: '#10b981' },
    { key: 'merit', label: 'Merit fit', glyph: '★', accent: '#ff4d8c' },
    { key: 'strategy', label: 'Strategy', glyph: '→', accent: '#7c3aed' },
  ],
  'Visas & immigration': [
    { key: 'visa-steps', label: 'Visa steps', glyph: '✈', accent: '#00b4d8' },
    { key: 'paperwork', label: 'Paperwork', glyph: '▤', accent: '#7c3aed' },
    { key: 'arrival', label: 'Arrival', glyph: '⌂', accent: '#ff4d8c' },
  ],
  'Student life': [
    { key: 'housing', label: 'Housing', glyph: '⌂', accent: '#00b4d8' },
    { key: 'culture', label: 'Culture', glyph: '◎', accent: '#ff4d8c' },
    { key: 'balance', label: 'Balance', glyph: '☼', accent: '#7c3aed' },
  ],
  Careers: [
    { key: 'employability', label: 'Employability', glyph: '↗', accent: '#ff4d8c' },
    { key: 'skills', label: 'Skills', glyph: '◆', accent: '#00b4d8' },
    { key: 'network', label: 'Network', glyph: '◌', accent: '#7c3aed' },
  ],
  'All topics': [
    { key: 'explore', label: 'Explore', glyph: '◈', accent: '#ff4d8c' },
    { key: 'decide', label: 'Decide', glyph: '→', accent: '#00b4d8' },
    { key: 'move', label: 'Move', glyph: '✦', accent: '#7c3aed' },
  ],
} as const;

function listMarkdownFiles() {
  const dirs = [paths.publishedDir, paths.draftsDir];
  const files: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) if (file.endsWith('.md')) files.push(path.join(dir, file));
  }
  return files;
}

function main() {
  ensureDir(paths.publicNewsImagesDir);
  const manifest: ImageEntry[] = [];
  for (const filePath of listMarkdownFiles()) {
    const markdown = readMarkdown(filePath);
    const { frontmatter, body } = parseFrontmatter(markdown);
    const slug = frontmatter.slug ?? path.basename(filePath, '.md');
    const title = frontmatter.title ?? slug;
    const topic = inferTopic(frontmatter, body);
    const pngPath = path.join(paths.publicNewsImagesDir, `${slug}.png`);
    const webpPath = path.join(paths.publicNewsImagesDir, `${slug}.webp`);
    const imagePath = fs.existsSync(pngPath)
      ? `/generated/news/${slug}.png`
      : fs.existsSync(webpPath)
        ? `/generated/news/${slug}.webp`
        : `/generated/news/${slug}.svg`;

    if (!fs.existsSync(pngPath) && !fs.existsSync(webpPath)) {
      writeFallbackNewsImage(slug, title, topic, frontmatter.targetCountry);
    }

    const supportAssets = (supportTemplates[topic as keyof typeof supportTemplates] ?? supportTemplates['All topics']).map((item) => {
      writeSupportAssetSvg(slug, item.key, item.label, topic, item.accent, item.glyph);
      return {
        kind: 'icon' as const,
        label: item.label,
        assetPath: `/generated/news/support/${slug}/${item.key}.svg`,
        prompt: buildSupportVisualPrompt(title, item.label, topic),
      };
    });

    manifest.push({
      slug,
      title,
      topic,
      prompt: buildHeroImagePrompt(frontmatter, topic),
      imagePath,
      imageStyle: imagePath.endsWith('.svg') ? 'svg-fallback' : 'ai',
      supportAssets,
    });
  }

  writeJsonFile(path.join(paths.reportsDir, 'image-manifest.json'), manifest);
  console.log(JSON.stringify({ generated: manifest.length, report: 'content/geo/reports/image-manifest.json' }, null, 2));
}

main();
