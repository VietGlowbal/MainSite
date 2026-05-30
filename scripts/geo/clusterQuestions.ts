import { cosineLikeSimilarity, listExistingPageSlugs, nowIso, readQuestions, slugify, stableId, writeClusters, writeQuestions } from './lib';
import type { RecommendedPageType, StudentQuestion, TopicCluster } from './types';

function chooseClusterKey(question: StudentQuestion) { return question.question.toLowerCase().includes('best uk computer science') ? 'flagship-uk-cs-ranking' : [question.studentSegment, question.targetCountry, question.subject, question.intent].filter(Boolean).join(' | '); }
function recommendedPageTypeFor(question: StudentQuestion): RecommendedPageType { if (question.intent === 'compare') return question.targetCountry === 'Multi-country' ? 'comparison' : 'ranking'; if (question.intent === 'scholarship') return 'scholarship'; if (question.intent === 'cost') return 'cost'; return 'guide'; }
function titleFor(group: StudentQuestion[]) { const first = group[0]; if (group.some((item) => item.question.toLowerCase().includes('best uk computer science'))) return 'Best UK Computer Science Degrees for Vietnamese Students in 2027'; const country = first.targetCountry && first.targetCountry !== 'Multi-country' ? `${first.targetCountry} ` : ''; const subject = first.subject && first.subject !== 'General' ? `${first.subject} ` : ''; const suffix = first.intent === 'scholarship' ? 'Scholarship Guide' : first.intent === 'cost' ? 'Cost Guide' : first.intent === 'compare' ? 'Comparison' : 'Guide'; return `${country}${subject}${suffix} for ${first.studentSegment}`.replace(/\s+/g, ' ').trim(); }

const questions = readQuestions();
const now = nowIso();
const existingPageSlugs = [...listExistingPageSlugs()];
const grouped = new Map<string, StudentQuestion[]>();
for (const question of questions) { if (question.status === 'rejected' || question.status === 'published') continue; const key = chooseClusterKey(question); grouped.set(key, [...(grouped.get(key) ?? []), question]); }
const clusters: TopicCluster[] = [];
for (const group of grouped.values()) {
  const title = titleFor(group);
  const slug = slugify(title);
  const first = group[0];
  const matchingExistingSlug = existingPageSlugs.find((existingSlug) => cosineLikeSimilarity(existingSlug, slug) > 0.6);
  clusters.push({ id: stableId('cluster', title), title, slug, primaryQuestion: [...group].sort((a, b) => b.importanceScore - a.importanceScore)[0].question, relatedQuestions: group.map((item) => item.question), studentSegment: first.studentSegment, targetCountry: first.targetCountry, subject: first.subject, recommendedPageType: recommendedPageTypeFor(first), existingPageSlug: matchingExistingSlug, action: matchingExistingSlug ? 'update-existing-page' : 'create-new-page', priorityScore: Math.min(100, group.reduce((sum, item) => sum + item.importanceScore, 0) + group.length * 4), createdAt: now, updatedAt: now });
}
const sortedClusters = clusters.sort((a, b) => b.priorityScore - a.priorityScore);
const questionSet = new Set(sortedClusters.flatMap((cluster) => cluster.relatedQuestions));
writeClusters(sortedClusters);
writeQuestions(questions.map((question) => questionSet.has(question.question) && question.status !== 'drafted' ? { ...question, status: 'clustered', updatedAt: now } : question));
console.log(JSON.stringify({ clusters: sortedClusters.slice(0, 4) }, null, 2));
