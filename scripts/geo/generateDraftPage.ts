import path from 'node:path';
import {
  fillTemplate,
  loadTemplate,
  nowIso,
  paths,
  readClusters,
  readManifest,
  readQuestions,
  sourcesForSlug,
  writeManifest,
  writeMarkdown,
  writeQuestions,
} from './lib';

const requested = process.argv[2];
const clusters = readClusters();
const cluster = requested
  ? clusters.find((item) => item.id === requested || item.slug === requested)
  : clusters.find((item) => item.slug === 'best-uk-computer-science-degrees-for-vietnamese-students-in-2027') ?? clusters[0];

if (!cluster) throw new Error('No topic cluster available');

const slug = cluster.slug;
const pageType = cluster.recommendedPageType === 'comparison' ? 'comparison' : cluster.recommendedPageType === 'ranking' ? 'ranking' : 'guide';
const template = loadTemplate(pageType);
const generatedAt = nowIso();
const title = cluster.title;
const description = `A Glowbal draft guide for ${cluster.studentSegment.toLowerCase()} comparing ${cluster.subject ?? 'study-abroad'} options in ${cluster.targetCountry ?? 'key destinations'}.`;
const sources = sourcesForSlug(slug);
const sourceLines = sources.length
  ? sources.map((source) => `- ${source.title} — ${source.url}`).join('\n')
  : '- TODO_SOURCE_REQUIRED: official source links still needed';

const markdown = fillTemplate(template, {
  title,
  shortAnswer:
    'For most Vietnamese students, the best UK Computer Science option is not simply the highest-ranked university. The strongest choice balances course fit, affordability, scholarship realism, employability, and admissions fit. Specific fees, IELTS thresholds, deadlines, and scholarship amounts still need line-by-line verification before publication.',
  audience:
    `This guide is for ${cluster.studentSegment.toLowerCase()} who want a shortlist that is useful for real application decisions, not just prestige browsing.`,
  comparisonTable:
    '| University | Why it may fit Vietnamese students | Watchouts | Source status |\n| --- | --- | --- | --- |\n| University of Manchester | Strong brand and broad CS offering | Tuition, offer profile, and scholarship detail need page-level verification before any precise claim | Official course page linked below |\n| University of Birmingham | Balanced academics and clear CS programme framing | Scholarship specifics and current costs need verification before publication | Official course page linked below |\n| University of Leeds | Strong computing profile and clear course overview | Exact admissions and fee detail need verification before publication | Official course page linked below |\n| University of Nottingham | Practical course framing and broad CS foundations | Exact requirement and cost detail need verification before publication | Official course page linked below |',
  methodology:
    `Glowbal ranked these options using a student-decision lens: course fit, total cost, scholarship realism, graduate outcome signals, and whether the university belongs in a reach, target, or safer shortlist for ${cluster.studentSegment.toLowerCase()}. We do not treat unsourced marketing claims or generic league-table positions as enough evidence. Any precise claim about fees, IELTS scores, scholarships, deadlines, or visa outcomes must be supported by an official source before the page becomes publishable.`,
  recommendations:
    '1. **Start with fit, not prestige.**\n2. **Compare course structure, not just the university name.**\n3. **Pressure-test affordability early using official fee and scholarship pages.**\n4. **Check career signals like placements, modules, and employer links on official course pages.**\n5. **Use Glowbal to compare options side by side and build a reach/target/safer shortlist.**',
  studentTypeBreakdown:
    '- **Brand-focused student:** Manchester may enter the conversation early, but only as one part of a balanced shortlist.\n- **Budget-sensitive student:** compare total cost and scholarship realism before prestige.\n- **Career-focused student:** prioritise course content, practical projects, and employer-facing opportunities.\n- **Student needing clarity fast:** use Glowbal to build 3 reach, 3 target, and 3 safer options.',
  decisionAdvice:
    'Do not choose a university on ranking position alone. Vietnamese students usually make better decisions when they compare course content, scholarship realism, city cost, and admissions fit together. Glowbal should feel like the decision engine that makes those tradeoffs legible.',
  faqs:
    '### What makes a UK Computer Science degree a good fit for Vietnamese students?\nA good fit combines course quality, affordability, scholarship potential, and a realistic admissions match.\n\n### Should students always choose the highest-ranked university they can target?\nNo. Fit and affordability matter more than headline prestige alone.\n\n### Can this page be published without review?\nNo. Any unresolved placeholder, unsourced requirement, or unsupported cost claim should block publication.',
  sources: sourceLines,
})
  .replace(/^title:\s*$/m, `title: ${title}`)
  .replace(/^description:\s*$/m, `description: ${description}`)
  .replace(/^slug:\s*$/m, `slug: ${slug}`)
  .replace(/^studentSegment:\s*$/m, `studentSegment: ${cluster.studentSegment}`)
  .replace(/^targetCountry:\s*$/m, `targetCountry: ${cluster.targetCountry ?? 'Multi-country'}`)
  .replace(/^subject:\s*$/m, `subject: ${cluster.subject ?? 'General'}`)
  .replace(/^lastUpdated:\s*$/m, `lastUpdated: ${generatedAt.slice(0, 10)}`);

const filePath = path.join(paths.draftsDir, `${slug}.md`);
writeMarkdown(filePath, markdown);
const manifest = readManifest().filter((item) => item.slug !== slug);
manifest.push({ generatedAt, clusterId: cluster.id, slug, title, filePath: path.relative(process.cwd(), filePath), pageType: cluster.recommendedPageType });
writeManifest(manifest);
writeQuestions(
  readQuestions().map((question) =>
    cluster.relatedQuestions.includes(question.question) ? { ...question, status: 'drafted', updatedAt: generatedAt } : question,
  ),
);
console.log(JSON.stringify({ slug, filePath: path.relative(process.cwd(), filePath), sourceCount: sources.length }, null, 2));
