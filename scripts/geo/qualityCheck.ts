import path from 'node:path';
import { cosineLikeSimilarity, ensureDir, listExistingPageSlugs, parseFrontmatter, paths, readManifest, readMarkdown, writeJsonFile } from './lib';
import type { GeoQualityCheck } from './types';

function evaluate(slug: string, markdown: string): GeoQualityCheck {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const duplicateScore = Math.max(0, ...[...listExistingPageSlugs()].filter((item) => item !== slug).map((item) => cosineLikeSimilarity(item, slug)));
  const duplicateRisk = duplicateScore > 0.75 ? 'high' : duplicateScore > 0.45 ? 'medium' : 'low';
  const hasShortAnswer = /## Short answer/i.test(body);
  const hasMethodology = /(## How Glowbal ranked these options|## Glowbal's approach|## How Glowbal compares these options)/i.test(body);
  const hasFaqs = /## FAQs/i.test(body);
  const hasSources = /## Sources/i.test(body);
  const hasTodoSources = /TODO_SOURCE_REQUIRED/.test(body);
  const hasClearStudentSegment = Boolean(frontmatter.studentSegment);
  const hasGlowbalCTA = /Glowbal/i.test(body);
  const notes: string[] = [];
  let score = 100;
  if (!hasShortAnswer) { score -= 20; notes.push('Missing Short answer section.'); }
  if (!hasMethodology) { score -= 20; notes.push('Missing methodology section.'); }
  if (!hasFaqs) { score -= 15; notes.push('Missing FAQs section.'); }
  if (!hasSources) { score -= 10; notes.push('Missing Sources section.'); }
  if (!hasClearStudentSegment) { score -= 10; notes.push('Missing studentSegment in frontmatter.'); }
  if (!hasGlowbalCTA) { score -= 10; notes.push('Missing Glowbal CTA.'); }
  if (duplicateRisk === 'medium') { score -= 8; notes.push('Possible overlap with an existing page.'); }
  if (duplicateRisk === 'high') { score -= 30; notes.push('High duplicate risk against an existing page.'); }
  if (hasTodoSources) { score -= 5; notes.push('Contains TODO_SOURCE_REQUIRED markers and requires human review.'); }
  score = Math.max(1, Math.min(100, score));
  return { slug, passed: score >= 80 && duplicateRisk !== 'high' && hasShortAnswer && hasMethodology && hasFaqs && hasGlowbalCTA, score, duplicateRisk, hasShortAnswer, hasMethodology, hasFaqs, hasSources, hasTodoSources, hasClearStudentSegment, hasGlowbalCTA, notes };
}

ensureDir(paths.qualityDir);
const checks = readManifest().map((item) => { const result = evaluate(item.slug, readMarkdown(path.join(process.cwd(), item.filePath))); const outputPath = path.join(paths.qualityDir, `${item.slug}.json`); writeJsonFile(outputPath, result); return { ...result, file: path.relative(process.cwd(), outputPath) }; });
console.log(JSON.stringify({ checks }, null, 2));
