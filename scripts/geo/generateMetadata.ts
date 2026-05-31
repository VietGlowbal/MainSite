import fs from 'node:fs';
import path from 'node:path';
import { buildHeroImagePrompt, ensureDir, estimateReadMinutes, inferTopic, parseFrontmatter, paths, readManifest, readMarkdown, writeJsonFile } from './lib';
import type { GeoPageMetadata } from './types';

function extractFaqPairs(body: string) {
  const lines = body.split('\n');
  const pairs: Array<{ question: string; answer: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('### ')) {
      const question = lines[i].replace(/^###\s*/, '').trim();
      const answer = (lines[i + 1] ?? '').trim();
      if (question && answer) pairs.push({ question, answer });
    }
  }
  return pairs;
}

function detectImagePath(slug: string) {
  const png = path.join(paths.publicNewsImagesDir, `${slug}.png`);
  const webp = path.join(paths.publicNewsImagesDir, `${slug}.webp`);
  if (fs.existsSync(png)) return { heroImage: `/generated/news/${slug}.png`, heroImageStyle: 'ai' as const };
  if (fs.existsSync(webp)) return { heroImage: `/generated/news/${slug}.webp`, heroImageStyle: 'ai' as const };
  return { heroImage: `/generated/news/${slug}.svg`, heroImageStyle: 'svg-fallback' as const };
}

function buildMetadata(markdown: string): GeoPageMetadata {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const title = frontmatter.title ?? 'Glowbal guide';
  const description = frontmatter.description ?? 'Glowbal GEO draft content';
  const slug = frontmatter.slug ?? 'draft';
  const topic = inferTopic(frontmatter, body);
  const canonicalUrl = `https://glowbal-education.com/guides/${slug}`;
  const breadcrumbs = [{ name: 'Home', item: 'https://glowbal-education.com/' }, { name: 'Guides', item: 'https://glowbal-education.com/guides' }, { name: title, item: canonicalUrl }];
  const image = detectImagePath(slug);
  return {
    title,
    metaDescription: description,
    canonicalUrl,
    slug,
    openGraphTitle: title,
    openGraphDescription: description,
    pageType: frontmatter.pageType ?? 'guide',
    topic,
    heroImage: image.heroImage,
    heroImagePrompt: buildHeroImagePrompt(frontmatter, topic),
    heroImageStyle: image.heroImageStyle,
    readingTimeMinutes: estimateReadMinutes(body),
    lastUpdated: frontmatter.lastUpdated ?? new Date().toISOString().slice(0, 10),
    schema: {
      article: { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, dateModified: frontmatter.lastUpdated, image: image.heroImage ? [`https://glowbal-education.com${image.heroImage}`] : undefined, author: { '@type': 'Organization', name: 'Glowbal' } },
      faq: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: extractFaqPairs(body).map((pair) => ({ '@type': 'Question', name: pair.question, acceptedAnswer: { '@type': 'Answer', text: pair.answer } })) },
      breadcrumb: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.item })) },
      organization: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Glowbal', url: 'https://glowbal-education.com', description: 'Glowbal helps international students compare universities, courses, scholarships, mentors, and application fit.' },
    },
  };
}

ensureDir(paths.metadataDir);
const draftPaths = new Set(readManifest().map((item) => path.join(process.cwd(), item.filePath)));
const fallbackDrafts = fs.existsSync(paths.draftsDir) ? fs.readdirSync(paths.draftsDir).filter((file) => file.endsWith('.md')).map((file) => path.join(paths.draftsDir, file)) : [];
const uniquePaths = [...new Set([...draftPaths, ...fallbackDrafts])];
const written = uniquePaths.map((filePath) => {
  const markdown = readMarkdown(filePath);
  const { frontmatter } = parseFrontmatter(markdown);
  const slug = frontmatter.slug ?? path.basename(filePath, '.md');
  const outputPath = path.join(paths.metadataDir, `${slug}.json`);
  writeJsonFile(outputPath, buildMetadata(markdown));
  return path.relative(process.cwd(), outputPath);
});
console.log(JSON.stringify({ written }, null, 2));
