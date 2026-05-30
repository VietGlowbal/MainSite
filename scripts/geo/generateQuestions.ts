import { nowIso, readQuestions, stableId, writeQuestions } from './lib';
import type { StudentQuestion, StudentQuestionIntent } from './types';

const generationPrompt = `Generate 10 specific, useful questions that international students would search for when choosing universities, courses, scholarships, countries, or application strategies.
Focus on:
- Vietnamese students
- UK, Australia, Canada, US, Europe
- undergraduate and master's applications
- affordability
- scholarships
- Computer Science, Business, Data Science, Engineering, Design, Medicine
- questions that could become useful Glowbal guide pages
Avoid duplicate questions.
Avoid generic questions.
Return JSON only.`;

const candidateQuestions = [
  'Best UK Computer Science degrees for Vietnamese students who want strong internships',
  'Which affordable UK universities are best for Vietnamese Data Science applicants?',
  'How should Vietnamese students compare scholarships in the UK, Canada, and Australia?',
  'What are the best Business analytics programmes in Canada for Vietnamese students?',
  'How much should Vietnamese families budget for a UK undergraduate degree in 2027?',
  'Which UK universities are safest target options for Vietnamese students applying to Engineering?',
  'What are the best European countries for Vietnamese Design students who want English-taught courses?',
  'How do Vietnamese students compare Computer Science and Software Engineering degrees abroad?',
  'Which UK scholarships are realistic for Vietnamese master’s students in Data Science?',
  'What should Vietnamese students check before choosing a UK university for Medicine?',
  'Which Australian universities offer the best value for Vietnamese Computer Science students?',
  'What documents do Vietnamese students need for UK postgraduate applications?',
];

function inferQuestionShape(question: string): Pick<StudentQuestion, 'studentSegment' | 'targetCountry' | 'subject' | 'intent' | 'funnelStage'> {
  const lower = question.toLowerCase();
  const targetCountryMap: Record<string, string> = { uk: 'UK', australia: 'Australia', canada: 'Canada', us: 'US', europe: 'Europe' };
  const matchedCountry = ['uk', 'australia', 'canada', 'us', 'europe'].find((country) => lower.includes(country));
  const targetCountry = matchedCountry ? targetCountryMap[matchedCountry] : 'Multi-country';
  const subjectMatch = ['computer science', 'business', 'data science', 'engineering', 'design', 'medicine'].find((item) => lower.includes(item));
  const subject = subjectMatch ? subjectMatch.split(' ').map((token) => token[0].toUpperCase() + token.slice(1)).join(' ') : 'General';
  const intent: StudentQuestionIntent = lower.includes('scholarship') ? 'scholarship' : lower.includes('cost') || lower.includes('budget') || lower.includes('affordable') || lower.includes('cheapest') ? 'cost' : lower.includes('visa') ? 'visa' : lower.includes('document') || lower.includes('ielts') || lower.includes('apply') ? 'application' : lower.includes('course') || lower.includes('degree') ? 'course-info' : lower.includes('compare') || lower.includes('best') || lower.includes('vs') ? 'compare' : 'general';
  const funnelStage = intent === 'application' || intent === 'visa' ? 'application' : intent === 'cost' ? 'early-research' : 'shortlisting';
  const studentSegment = lower.includes('master') ? "Vietnamese master's applicant" : 'Vietnamese undergraduate applicant';
  return { studentSegment, targetCountry, subject, intent, funnelStage };
}

const existing = readQuestions();
const existingNormalized = new Set(existing.map((item) => item.question.toLowerCase().trim()));
const generatedAt = nowIso();
const newQuestions: StudentQuestion[] = [];
for (const question of candidateQuestions) {
  if (newQuestions.length >= 10) break;
  if (existingNormalized.has(question.toLowerCase().trim())) continue;
  newQuestions.push({ id: stableId('sq', `${generatedAt}-${question}`), question, importanceScore: 7, source: 'ai-generated', status: 'new', createdAt: generatedAt, updatedAt: generatedAt, ...inferQuestionShape(question) });
}
writeQuestions([...existing, ...newQuestions]);
console.log(JSON.stringify({ prompt: generationPrompt, added: newQuestions.length, total: existing.length + newQuestions.length }, null, 2));
