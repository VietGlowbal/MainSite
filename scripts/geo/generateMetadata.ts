import fs from 'node:fs';
import path from 'node:path';
import { buildHeroImagePrompt, ensureDir, estimateReadMinutes, inferTopic, parseFrontmatter, paths, readManifest, readMarkdown, slugify, writeJsonFile } from './lib';
import type { GeoPageMetadata, GeoSupportAsset, GeoSupportCard } from './types';

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

function extractToc(body: string) {
  return body
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => {
      const title = line.replace(/^##\s*/, '').trim();
      return { id: slugify(title), title };
    });
}

function detectImagePath(slug: string) {
  const png = path.join(paths.publicNewsImagesDir, `${slug}.png`);
  const webp = path.join(paths.publicNewsImagesDir, `${slug}.webp`);
  if (fs.existsSync(png)) return { heroImage: `/generated/news/${slug}.png`, heroImageStyle: 'ai' as const };
  if (fs.existsSync(webp)) return { heroImage: `/generated/news/${slug}.webp`, heroImageStyle: 'ai' as const };
  return { heroImage: `/generated/news/${slug}.svg`, heroImageStyle: 'svg-fallback' as const };
}

function buildTags(frontmatter: Record<string, string>, topic: string) {
  return [topic, frontmatter.subject, frontmatter.studentSegment, frontmatter.targetCountry && frontmatter.targetCountry !== 'Multi-country' ? `${frontmatter.targetCountry} 2027 entry` : undefined]
    .filter(Boolean) as string[];
}

function buildSupportCards(topic: string, frontmatter: Record<string, string>): GeoSupportCard[] {
  const segment = frontmatter.studentSegment ?? 'international students';
  const country = frontmatter.targetCountry && frontmatter.targetCountry !== 'Multi-country' ? frontmatter.targetCountry : 'their chosen destination';
  if (topic === 'Scholarships') {
    return [
      { title: 'Funding opportunities', description: `Shortlist scholarships that are genuinely realistic for ${segment.toLowerCase()}.`, icon: '/generated/news/support/default/funding.svg', accent: 'emerald' },
      { title: 'Eligibility fit', description: 'Filter options by academic profile, English score, and course alignment.', icon: '/generated/news/support/default/merit.svg', accent: 'pink' },
      { title: 'Application timing', description: 'Sequence scholarship prep early so funding and admissions work together.', icon: '/generated/news/support/default/strategy.svg', accent: 'violet' },
    ];
  }
  if (topic === 'Applications') {
    return [
      { title: 'Application planning', description: `Map the strongest route into ${country} without missing key deadlines.`, icon: '/generated/news/support/default/planning.svg', accent: 'pink' },
      { title: 'Document readiness', description: 'Keep SOPs, references, and transcripts aligned before submission.', icon: '/generated/news/support/default/documents.svg', accent: 'cyan' },
      { title: 'Execution rhythm', description: 'Turn a complex process into a clear next-step sequence.', icon: '/generated/news/support/default/deadlines.svg', accent: 'violet' },
    ];
  }
  return [
    { title: 'Globally recognised degrees', description: `Compare institutions in ${country} that signal quality to employers and families.`, icon: '/generated/news/support/default/global-recognition.svg', accent: 'violet' },
    { title: 'Strong career outcomes', description: 'Prioritise course structures that translate into employability and progression.', icon: '/generated/news/support/default/career-outcomes.svg', accent: 'cyan' },
    { title: 'Innovation & research', description: 'Look for modern teaching, project work, and credible academic depth.', icon: '/generated/news/support/default/innovation.svg', accent: 'pink' },
  ];
}

function buildSupportAssets(slug: string, topic: string): GeoSupportAsset[] {
  const supportDir = path.join(paths.publicSupportDir, slug);
  if (!fs.existsSync(supportDir)) return [];
  return fs.readdirSync(supportDir)
    .filter((file) => file.endsWith('.svg'))
    .sort()
    .map((file) => ({
      kind: 'icon' as const,
      label: file.replace(/\.svg$/, '').replace(/-/g, ' '),
      assetPath: `/generated/news/support/${slug}/${file}`,
      prompt: `Supporting icon for ${topic.toLowerCase()} article UI in Glowbal's editorial system.`,
    }));
}

function buildKeyTakeaway(frontmatter: Record<string, string>, topic: string) {
  const segment = frontmatter.studentSegment ?? 'international students';
  const subject = frontmatter.subject ?? 'study abroad options';
  const country = frontmatter.targetCountry && frontmatter.targetCountry !== 'Multi-country' ? frontmatter.targetCountry : 'top destinations';
  return `For ${segment.toLowerCase()}, the best ${subject.toLowerCase()} choice in ${country} usually comes from balancing fit, cost, outcomes, and execution — not chasing prestige alone.`;
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
    keyTakeaway: buildKeyTakeaway(frontmatter, topic),
    tags: buildTags(frontmatter, topic),
    supportCards: buildSupportCards(topic, frontmatter),
    supportAssets: buildSupportAssets(slug, topic),
    toc: extractToc(body),
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
