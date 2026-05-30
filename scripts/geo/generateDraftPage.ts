import path from 'node:path';
import { fillTemplate, loadTemplate, nowIso, paths, readClusters, readManifest, readQuestions, writeManifest, writeMarkdown, writeQuestions } from './lib';

const requested = process.argv[2];
const clusters = readClusters();
const cluster = requested ? clusters.find((item) => item.id === requested || item.slug === requested) : clusters.find((item) => item.slug === 'best-uk-computer-science-degrees-for-vietnamese-students-in-2027') ?? clusters[0];
if (!cluster) throw new Error('No topic cluster available');

const pageType = cluster.recommendedPageType === 'comparison' ? 'comparison' : cluster.recommendedPageType === 'ranking' ? 'ranking' : 'guide';
const template = loadTemplate(pageType);
const generatedAt = nowIso();
const title = cluster.title;
const description = `A Glowbal draft guide for ${cluster.studentSegment.toLowerCase()} comparing ${cluster.subject ?? 'study-abroad'} options in ${cluster.targetCountry ?? 'key destinations'}.`;

const markdown = fillTemplate(template, {
  title,
  shortAnswer: 'For most Vietnamese students, the best UK Computer Science option is not simply the highest-ranked university. The strongest choice balances course fit, affordability, scholarship realism, employability, and admissions fit. TODO_SOURCE_REQUIRED: official tuition pages, course pages, scholarship pages, and graduate outcome sources.',
  audience: `This guide is for ${cluster.studentSegment.toLowerCase()} who want a shortlist that is useful for real application decisions, not just prestige browsing.`,
  comparisonTable: '| University | Why it may fit Vietnamese students | Watchouts | Source status |\n| --- | --- | --- | --- |\n| University of Manchester | Strong brand and broad CS offering | Cost and offer profile need checking | TODO_SOURCE_REQUIRED |\n| University of Birmingham | Balanced academics and support | Scholarship specifics need checking | TODO_SOURCE_REQUIRED |\n| University of Southampton | Strong computing reputation | Course variants need mapping | TODO_SOURCE_REQUIRED |\n| University of York | Often attractive on value and student experience | Employability metrics need sourcing | TODO_SOURCE_REQUIRED |',
  methodology: `Glowbal ranked these options using a student-decision lens: course fit, total cost, scholarship realism, graduate outcome signals, and whether the university belongs in a reach, target, or safer shortlist for ${cluster.studentSegment.toLowerCase()}. Unsupported facts should stay marked TODO_SOURCE_REQUIRED until a reviewer adds official sources.`,
  recommendations: '1. **Start with fit, not prestige.**\n2. **Compare course structure, not just the university name.**\n3. **Pressure-test affordability early.**\n4. **Check career signals like placements and employer links.**\n5. **Use Glowbal to compare options side by side.**',
  studentTypeBreakdown: '- **Brand-focused student:** keep ambitious options, but do not skip realistic backups.\n- **Budget-sensitive student:** prioritise total cost and scholarship realism.\n- **Career-focused student:** weight placement years, industry projects, and graduate outcomes more heavily.\n- **Student needing clarity fast:** use Glowbal to build 3 reach, 3 target, and 3 safer options.',
  decisionAdvice: 'Do not choose a university on ranking position alone. Vietnamese students usually make better decisions when they compare course content, scholarship realism, city cost, and admissions fit together.',
  faqs: '### What makes a UK Computer Science degree a good fit for Vietnamese students?\nA good fit combines course quality, affordability, scholarship potential, and a realistic admissions match.\n\n### Should students always choose the highest-ranked university they can target?\nNo. Fit and affordability matter more than headline prestige alone.\n\n### Can this page be published without review?\nNo. Any TODO_SOURCE_REQUIRED marker means a human must verify the claim first.',
  sources: '- TODO_SOURCE_REQUIRED: official university course pages\n- TODO_SOURCE_REQUIRED: official tuition fee pages\n- TODO_SOURCE_REQUIRED: official scholarship pages\n- TODO_SOURCE_REQUIRED: official graduate outcome sources\n- TODO_SOURCE_REQUIRED: visa and proof-of-funds guidance',
})
.replace(/^title:\s*$/m, `title: ${title}`)
.replace(/^description:\s*$/m, `description: ${description}`)
.replace(/^slug:\s*$/m, `slug: ${cluster.slug}`)
.replace(/^studentSegment:\s*$/m, `studentSegment: ${cluster.studentSegment}`)
.replace(/^targetCountry:\s*$/m, `targetCountry: ${cluster.targetCountry ?? 'Multi-country'}`)
.replace(/^subject:\s*$/m, `subject: ${cluster.subject ?? 'General'}`)
.replace(/^lastUpdated:\s*$/m, `lastUpdated: ${generatedAt.slice(0, 10)}`);

const filePath = path.join(paths.draftsDir, `${cluster.slug}.md`);
writeMarkdown(filePath, markdown);
const manifest = readManifest().filter((item) => item.slug !== cluster.slug);
manifest.push({ generatedAt, clusterId: cluster.id, slug: cluster.slug, title, filePath: path.relative(process.cwd(), filePath), pageType: cluster.recommendedPageType });
writeManifest(manifest);
writeQuestions(readQuestions().map((question) => cluster.relatedQuestions.includes(question.question) ? { ...question, status: 'drafted', updatedAt: generatedAt } : question));
console.log(JSON.stringify({ slug: cluster.slug, filePath: path.relative(process.cwd(), filePath) }, null, 2));
