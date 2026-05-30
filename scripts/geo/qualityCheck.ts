import path from 'node:path';
import {
  cosineLikeSimilarity,
  ensureDir,
  listExistingPageSlugs,
  parseFrontmatter,
  paths,
  readConfig,
  readManifest,
  readMarkdown,
  sourcesForSlug,
  writeJsonFile,
} from './lib';
import type { GeoQualityCheck, GeoReviewStatus } from './types';

function hasSpecificTuitionClaims(body: string) {
  const lines = body.split('\n');
  return lines.some((line) => {
    const lower = line.toLowerCase();
    const mentionsCost = /\b(tuition|fee|fees|cost|costs)\b/.test(lower);
    const looksLikePrice = /(?:£|\$|€)\s?\d|\b\d{4,6}\b/.test(line);
    return mentionsCost && looksLikePrice && !/^[-*] .*https?:\/\//.test(line);
  });
}

function hasSpecificEntryClaims(body: string) {
  const lines = body.split('\n');
  return lines.some((line) => {
    const lower = line.toLowerCase();
    const mentionsEntry = /\b(ielts|entry requirement|entry requirements|requirement|requirements)\b/.test(lower);
    const looksLikeScore = /\b[4-9](?:\.\d)?\b|\b\d{2,3}\s?(?:ucas|tariff)?\b/i.test(line);
    return mentionsEntry && looksLikeScore && !/^[-*] .*https?:\/\//.test(line);
  });
}

function hasGenericAiPhrases(body: string) {
  return /(in today's competitive world|navigate the complex landscape|journey of studying abroad|unlock your potential)/i.test(
    body,
  );
}

function evaluate(slug: string, markdown: string): GeoQualityCheck {
  const config = readConfig();
  const { frontmatter, body } = parseFrontmatter(markdown);
  const duplicateScore = Math.max(
    0,
    ...[...listExistingPageSlugs()]
      .filter((item) => item !== slug)
      .map((item) => cosineLikeSimilarity(item, slug)),
  );
  const duplicateRisk = duplicateScore > 0.75 ? 'high' : duplicateScore > 0.45 ? 'medium' : 'low';
  const hasShortAnswer = /## Short answer/i.test(body);
  const hasMethodology =
    /(## How Glowbal ranked these options|## Glowbal's approach|## How Glowbal compares these options)/i.test(body);
  const hasFaqs = /## FAQs/i.test(body);
  const hasSources = /## Sources/i.test(body);
  const todoSourceCount = (body.match(/TODO_SOURCE_REQUIRED/g) ?? []).length;
  const hasTodoSources = todoSourceCount > 0;
  const hasClearStudentSegment = Boolean(frontmatter.studentSegment);
  const hasGlowbalCTA = /Glowbal/i.test(body);
  const officialSourceCount = sourcesForSlug(slug).filter((source) =>
    ['official-university', 'official-government', 'official-scholarship'].includes(source.sourceType),
  ).length;
  const hasTuitionNumbersWithoutSource = hasSpecificTuitionClaims(body);
  const hasEntryNumbersWithoutSource = hasSpecificEntryClaims(body);
  const rankingLanguageWithoutMethodology = /(\bbest\b|\btop\b|\branked\b)/i.test(body) && !hasMethodology;
  const genericAiPhrases = hasGenericAiPhrases(body);
  const notes: string[] = [];
  const blockerReasons: string[] = [];
  let score = 100;
  if (!hasShortAnswer) {
    score -= 20;
    notes.push('Missing Short answer section.');
  }
  if (!hasMethodology) {
    score -= 20;
    notes.push('Missing methodology section.');
  }
  if (!hasFaqs) {
    score -= 15;
    notes.push('Missing FAQs section.');
  }
  if (!hasSources) {
    score -= 10;
    notes.push('Missing Sources section.');
  }
  if (!hasClearStudentSegment) {
    score -= 10;
    notes.push('Missing studentSegment in frontmatter.');
  }
  if (!hasGlowbalCTA) {
    score -= 10;
    notes.push('Missing Glowbal CTA.');
  }
  if (duplicateRisk === 'medium') {
    score -= 8;
    notes.push('Possible overlap with an existing page.');
  }
  if (duplicateRisk === 'high') {
    score -= 30;
    notes.push('High duplicate risk against an existing page.');
  }
  if (hasTodoSources) {
    score -= Math.min(12, todoSourceCount * 2);
    notes.push('Contains TODO_SOURCE_REQUIRED markers and requires human review.');
  }
  if (genericAiPhrases) {
    score -= 20;
    notes.push('Contains generic AI filler language.');
  }
  if (hasTuitionNumbersWithoutSource)
    blockerReasons.push('Contains specific tuition or cost numbers without a linked source.');
  if (hasEntryNumbersWithoutSource)
    blockerReasons.push('Contains specific IELTS or entry requirement numbers without a linked source.');
  if (rankingLanguageWithoutMethodology) blockerReasons.push('Uses ranking language without a methodology section.');
  if (duplicateRisk === 'high') blockerReasons.push('High duplicate risk.');
  if (genericAiPhrases) blockerReasons.push('Contains generic AI filler language.');
  score = Math.max(1, Math.min(100, score));
  const passed =
    score >= 70 && duplicateRisk !== 'high' && hasShortAnswer && hasMethodology && hasFaqs && hasGlowbalCTA;
  let reviewStatus: GeoReviewStatus = 'draft';
  if (
    officialSourceCount > 0 &&
    !hasTodoSources &&
    blockerReasons.length === 0 &&
    (!config.requireSourcesForPublishable || officialSourceCount > 0)
  )
    reviewStatus = 'publishable';
  else if (officialSourceCount > 0 || hasTodoSources || blockerReasons.length > 0) reviewStatus = 'needs-review';
  const publishable = reviewStatus === 'publishable';
  const reviewRequired = config.requireHumanReview ? reviewStatus !== 'publishable' : blockerReasons.length > 0;
  return {
    slug,
    passed,
    publishable,
    reviewRequired,
    reviewStatus,
    score,
    duplicateRisk,
    hasShortAnswer,
    hasMethodology,
    hasFaqs,
    hasSources,
    hasTodoSources,
    hasClearStudentSegment,
    hasGlowbalCTA,
    officialSourceCount,
    todoSourceCount,
    blockerReasons,
    notes,
  };
}

ensureDir(paths.qualityDir);
const checks = readManifest().map((item) => {
  const result = evaluate(item.slug, readMarkdown(path.join(process.cwd(), item.filePath)));
  const outputPath = path.join(paths.qualityDir, `${item.slug}.json`);
  writeJsonFile(outputPath, result);
  return { ...result, file: path.relative(process.cwd(), outputPath) };
});
console.log(JSON.stringify({ checks }, null, 2));
