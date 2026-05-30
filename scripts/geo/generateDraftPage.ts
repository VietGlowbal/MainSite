import path from 'node:path';
import { fillTemplate, loadTemplate, nowIso, paths, readClusters, readConfig, readQuestions, sourcesForSlug, writeManifest, writeMarkdown, writeQuestions } from './lib';
import type { DraftManifest, TopicCluster } from './types';

function buildMarkdown(cluster: TopicCluster, generatedAt: string) {
  const slug = cluster.slug;
  const pageType = cluster.recommendedPageType === 'comparison' ? 'comparison' : cluster.recommendedPageType === 'ranking' ? 'ranking' : 'guide';
  const template = loadTemplate(pageType);
  const title = cluster.title;
  const description = `A Glowbal draft guide for ${cluster.studentSegment.toLowerCase()} comparing ${cluster.subject ?? 'study-abroad'} options in ${cluster.targetCountry ?? 'key destinations'}.`;
  const sources = sourcesForSlug(slug);
  const sourceLines = sources.length ? sources.map((source) => `- ${source.title} — ${source.url}`).join('\n') : '- TODO_SOURCE_REQUIRED: official source links still needed';
  return fillTemplate(template, {
    title,
    shortAnswer: sources.length > 0 ? 'For most students, the best option is rarely just the highest-ranked university. The stronger choice usually balances course fit, affordability, scholarship realism, employability, and admissions fit. Use the official source list below before turning any comparison into a published recommendation.' : 'For most students, the strongest shortlist balances course fit, affordability, scholarship realism, employability, and admissions fit. TODO_SOURCE_REQUIRED: add official course, scholarship, and visa sources before publication.',
    audience: `This guide is for ${cluster.studentSegment.toLowerCase()} who want a shortlist that is useful for real application decisions, not just prestige browsing.`,
    comparisonTable: cluster.subject === 'Computer Science' ? '| University | Why it may fit students | Watchouts | Source status |\n| --- | --- | --- | --- |\n| University of Manchester | Strong brand and broad CS offering | Tuition and scholarship detail need verification before precise claims | Official course page linked below |\n| University of Birmingham | Balanced academics and clear CS programme framing | Cost specifics need verification before publication | Official course page linked below |\n| University of Leeds | Strong computing profile and clear course overview | Exact admissions and fee detail need verification | Official course page linked below |\n| University of Nottingham | Practical course framing and broad CS foundations | Exact requirement and cost detail need verification | Official course page linked below |' : '| Option | Why it may fit | Watchouts | Source status |\n| --- | --- | --- | --- |\n| Option A | Good thematic fit for the student segment | Needs human verification and polish | TODO_SOURCE_REQUIRED |\n| Option B | Useful comparison point for affordability or outcomes | Needs human verification and polish | TODO_SOURCE_REQUIRED |\n| Option C | Useful comparison point for shortlist balance | Needs human verification and polish | TODO_SOURCE_REQUIRED |',
    methodology: `Glowbal ranked these options using a student-decision lens: course fit, total cost, scholarship realism, graduate outcome signals, and whether the university belongs in a reach, target, or safer shortlist for ${cluster.studentSegment.toLowerCase()}. In testing mode, some drafts may still be generic and will need human review before anything publishable happens.`,
    recommendations: '1. **Start with fit, not prestige.**\n2. **Compare course structure, not just the university name.**\n3. **Pressure-test affordability early.**\n4. **Check career signals like placements, modules, and employer links.**\n5. **Use Glowbal to compare options side by side and build a reach/target/safer shortlist.**',
    studentTypeBreakdown: '- **Brand-focused student:** keep ambitious options, but do not skip realistic backups.\n- **Budget-sensitive student:** compare total cost and scholarship realism before prestige.\n- **Career-focused student:** prioritise course content, practical projects, and employer-facing opportunities.\n- **Student needing clarity fast:** use Glowbal to build 3 reach, 3 target, and 3 safer options.',
    decisionAdvice: 'Do not choose a university on ranking position alone. Students usually make better decisions when they compare course content, scholarship realism, city cost, and admissions fit together. Glowbal should feel like the decision engine that makes those tradeoffs legible.',
    faqs: '### What makes this page useful for students?\nIt turns a vague search query into a shortlist framework students can actually use.\n\n### Can this draft include unknown facts?\nNo. If a fee, requirement, deadline, scholarship, or visa claim is not verified, leave TODO_SOURCE_REQUIRED in place.\n\n### Can this be published live during testing?\nYes, but it should still be treated as experimental until reviewed.',
    sources: sourceLines,
  }).replace(/^title:\s*$/m, `title: ${title}`).replace(/^description:\s*$/m, `description: ${description}`).replace(/^slug:\s*$/m, `slug: ${slug}`).replace(/^studentSegment:\s*$/m, `studentSegment: ${cluster.studentSegment}`).replace(/^targetCountry:\s*$/m, `targetCountry: ${cluster.targetCountry ?? 'Multi-country'}`).replace(/^subject:\s*$/m, `subject: ${cluster.subject ?? 'General'}`).replace(/^lastUpdated:\s*$/m, `lastUpdated: ${generatedAt.slice(0, 10)}`);
}

const requested = process.argv[2];
const config = readConfig();
const clusters = readClusters();
const selectedClusters = requested ? clusters.filter((item) => item.id === requested || item.slug === requested) : clusters.filter((item) => item.action !== 'ignore').slice(0, Math.min(5, Math.max(1, config.draftPagesPerRun)));
if (selectedClusters.length === 0) throw new Error('No topic clusters available');
const generatedAt = nowIso();
const manifest: DraftManifest[] = [];
const questions = readQuestions();
const draftedQuestions = new Set(selectedClusters.flatMap((cluster) => cluster.relatedQuestions));
const generated: Array<Record<string, unknown>> = [];
for (const cluster of selectedClusters) {
  const markdown = buildMarkdown(cluster, generatedAt);
  const filePath = path.join(paths.draftsDir, `${cluster.slug}.md`);
  writeMarkdown(filePath, markdown);
  manifest.push({ generatedAt, clusterId: cluster.id, slug: cluster.slug, title: cluster.title, filePath: path.relative(process.cwd(), filePath), pageType: cluster.recommendedPageType });
  generated.push({ slug: cluster.slug, filePath: path.relative(process.cwd(), filePath), sourceCount: sourcesForSlug(cluster.slug).length });
}
writeManifest(manifest);
writeQuestions(questions.map((question) => draftedQuestions.has(question.question) ? { ...question, status: 'drafted', updatedAt: generatedAt } : question));
console.log(JSON.stringify({ generatedCount: generated.length, generated, mode: config.mode }, null, 2));
