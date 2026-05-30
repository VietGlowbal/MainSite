import path from 'node:path';
import { ensureDir, parseFrontmatter, paths, readManifest, readMarkdown, writeJsonFile } from './lib';
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

function buildMetadata(markdown: string): GeoPageMetadata {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const title = frontmatter.title ?? 'Glowbal guide';
  const description = frontmatter.description ?? 'Glowbal GEO draft content';
  const slug = frontmatter.slug ?? 'draft';
  const canonicalUrl = `https://glowbal.co/geo/${slug}`;
  const breadcrumbs = [{ name: 'Home', item: 'https://glowbal.co/' }, { name: 'Guides', item: 'https://glowbal.co/geo' }, { name: title, item: canonicalUrl }];
  return {
    title,
    metaDescription: description,
    canonicalUrl,
    slug,
    openGraphTitle: title,
    openGraphDescription: description,
    pageType: frontmatter.pageType ?? 'guide',
    lastUpdated: frontmatter.lastUpdated ?? new Date().toISOString().slice(0, 10),
    schema: {
      article: { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, dateModified: frontmatter.lastUpdated, author: { '@type': 'Organization', name: 'Glowbal' } },
      faq: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: extractFaqPairs(body).map((pair) => ({ '@type': 'Question', name: pair.question, acceptedAnswer: { '@type': 'Answer', text: pair.answer } })) },
      breadcrumb: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.item })) },
      organization: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Glowbal', url: 'https://glowbal.co', description: 'Glowbal helps international students compare universities, courses, scholarships, mentors, and application fit.' },
    },
  };
}

ensureDir(paths.metadataDir);
const written = readManifest().map((item) => { const outputPath = path.join(paths.metadataDir, `${item.slug}.json`); writeJsonFile(outputPath, buildMetadata(readMarkdown(path.join(process.cwd(), item.filePath)))); return path.relative(process.cwd(), outputPath); });
console.log(JSON.stringify({ written }, null, 2));
