import type { ConfidenceLevel, ReflectionAnswers } from './types';

/**
 * Static mock "AI output" for every task type (spec §13 — GenUI per type).
 * All demo data (CLAUDE.md's rule on AI-generated content that could pass
 * for a real student's) — none of it is a real Cambridge requirement,
 * report, or match calculation. Confidence levels are shown wherever
 * content claims to be AI-extracted.
 */

export const DEMO_STUDENT_NAME = 'Alex Nguyen';

/** Pre-filled demo answers for the reflection task's "Use demo answer" button. */
export const DEMO_REFLECTION_ANSWERS: ReflectionAnswers = {
  built:
    'I built a low-cost air-quality monitoring system using Arduino sensors for classrooms in my school.',
  owned:
    'I owned the whole sensor-to-dashboard pipeline — picking the Arduino sensors, writing the code that read them, and building the simple dashboard that showed air quality live in the classroom.',
  difficult:
    'Getting reliable readings was hard. The sensors drifted with temperature, so I had to calibrate them against a reference device and write code to correct for it before the numbers were trustworthy.',
};

export type AchievementEntry = { id: string; title: string; category: string; year: string };

export const DEMO_ACHIEVEMENTS: readonly AchievementEntry[] = [
  { id: 'ach-1', title: 'Regional Science Fair — 2nd place, Engineering category', category: 'Competition', year: '2025' },
  { id: 'ach-2', title: 'School STEM Club — Founder & President', category: 'Leadership', year: '2024–2026' },
  { id: 'ach-3', title: 'Peer tutoring — Physics & Maths, 15+ students', category: 'Community', year: '2024–2026' },
];

export const PERSONAL_REPORT = {
  overallConfidence: 'medium' as ConfidenceLevel,
  strengths: [
    { text: 'Hands-on engineering project with a working prototype', confidence: 'high' as ConfidenceLevel },
    { text: 'Ownership of a full build, from design through deployment', confidence: 'high' as ConfidenceLevel },
    { text: 'Comfortable discussing technical trade-offs and calibration', confidence: 'medium' as ConfidenceLevel },
  ],
  gaps: [
    { text: 'No admissions test practice logged yet', confidence: 'high' as ConfidenceLevel },
    { text: 'Academic transcript not yet reviewed for A*A*A tracking', confidence: 'low' as ConfidenceLevel },
  ],
};

export type MatchingReport = {
  score: number;
  tier: 'reach' | 'recommended' | 'safe';
  summary: string;
  confidence: ConfidenceLevel;
};

export const MATCHING_REPORT: MatchingReport = {
  score: 62,
  tier: 'reach',
  confidence: 'medium',
  summary:
    'Your project evidence is strong for Engineering, but we don’t have your predicted grades or admissions-test prep yet — both move this number a lot.',
};

export type StrategyPriority = { title: string; detail: string; icon: string };

export const STRATEGY_PRIORITIES: readonly StrategyPriority[] = [
  { icon: '🌍', title: 'Problem solving for real-world impact', detail: 'Apply engineering to solve meaningful global challenges.' },
  { icon: '💡', title: 'Innovative design & creativity', detail: 'Design elegant, user-centred solutions.' },
  { icon: '🤝', title: 'Leadership & collaboration', detail: 'Work with others to deliver ambitious outcomes.' },
  { icon: '📚', title: 'Continuous learning & growth', detail: 'Stay curious and push the boundaries.' },
];

export const STRATEGY_POSITIONING =
  'I am a curious problem solver who uses creativity, data and collaboration to design solutions that make a positive impact. I want to study Engineering at Cambridge to learn from world-leading innovators and grow the skills to build a better future.';

export const STRATEGY_STRENGTHS = ['Analytical thinking', 'Creative problem solving', 'Persistence & resilience', 'Evidence of leadership'];
export const STRATEGY_GAPS = ['Advanced mathematics', 'Technical communication', 'Breadth of engineering exposure'];

export type ScholarshipMatch = { id: string; name: string; award: string; matchScore: number; note: string };

export const SCHOLARSHIP_MATCHES: readonly ScholarshipMatch[] = [
  {
    id: 'scholarship-cambridge-trust',
    name: 'Cambridge Trust Scholarship',
    award: 'Up to full tuition',
    matchScore: 92,
    note: 'Awarded to outstanding applicants with strong academic results and leadership potential.',
  },
  {
    id: 'scholarship-engineering-futures',
    name: 'Engineering Futures Award',
    award: '£4,000 / year',
    matchScore: 76,
    note: 'For applicants with a demonstrated hands-on engineering project — your air-quality build is a strong fit.',
  },
];

export type EvidencePrompt = { question: string; aiSuggestion: string };

export type EvidenceFocus = {
  title: string;
  intro: string;
  contextNote: string;
  prompts: readonly EvidencePrompt[];
};

export const EVIDENCE_FOCUS: Record<'engineering' | 'leadership' | 'wording' | 'gaps', EvidenceFocus> = {
  engineering: {
    title: 'Strengthen your engineering evidence',
    intro: 'A few quick prompts to turn your project into evidence Cambridge will actually read.',
    contextNote: 'We already know about your air-quality monitoring project from your reflection.',
    prompts: [
      { question: 'What did you build?', aiSuggestion: 'A low-cost Arduino-based air-quality monitoring system for classrooms.' },
      { question: 'What impact did it have?', aiSuggestion: 'Deployed in 3 classrooms; flagged two ventilation issues the school fixed.' },
      { question: 'What was your role?', aiSuggestion: 'Sole designer and builder, from sensor selection to classroom deployment.' },
    ],
  },
  leadership: {
    title: 'Add leadership evidence',
    intro: 'Founding the STEM club is worth more on paper than it sounds in conversation — let’s write it up properly.',
    contextNote: 'Pulled from your achievements: "School STEM Club — Founder & President".',
    prompts: [
      { question: 'What did you set out to do?', aiSuggestion: 'Start a club so more students could try hands-on engineering outside class.' },
      { question: 'What did you personally lead?', aiSuggestion: 'Recruiting members, running weekly sessions, and organising the science fair entry.' },
      { question: 'What changed because of it?', aiSuggestion: 'Grew from 4 to 20+ members in a year; two members placed at the regional fair.' },
    ],
  },
  wording: {
    title: 'Improve activity impact wording',
    intro: 'Same activities, sharper language — reviewers skim, so the verb in the first line matters.',
    contextNote: 'Applies to your existing achievements and reflection answers.',
    prompts: [
      { question: 'Weak: "Was involved in the STEM club."', aiSuggestion: 'Stronger: "Founded and led a 20-member STEM club."' },
      { question: 'Weak: "Helped with a project about air quality."', aiSuggestion: 'Stronger: "Designed and deployed an air-quality monitoring system across 3 classrooms."' },
    ],
  },
  gaps: {
    title: 'Address academic / profile gaps',
    intro: 'Your Personal Report flagged two gaps — here’s the fastest way to close them.',
    contextNote: 'From your Personal Report: no admissions-test practice logged, transcript not yet reviewed.',
    prompts: [
      { question: 'Admissions test practice', aiSuggestion: 'Log one timed ESAT paper — even one gives your match score real signal instead of a guess.' },
      { question: 'Transcript for A*A*A tracking', aiSuggestion: 'Upload your latest transcript so we can track progress against Cambridge’s offer automatically.' },
    ],
  },
};

export const CV_INTRO = 'We already know about your project.';
export const CV_SUGGESTED_LABEL = 'Suggested CV entry';
export const CV_ENTRY =
  'Designed and built a low-cost Arduino-based air-quality monitoring system for classrooms, from sensor selection through classroom deployment.';

export const STATEMENT_SUGGESTION =
  'From the first time I short-circuited a breadboard trying to read a gas sensor, I understood that engineering is not about getting things right the first time — it’s about building a system that tells you when it’s wrong.';

export type RecommenderStatus = 'not_requested' | 'requested' | 'confirmed';

export const RECOMMENDER = {
  name: 'Dr. Sarah Chen',
  role: 'Physics Teacher',
  status: 'requested' as RecommenderStatus,
  requestedOn: '2 May 2026',
};

export type DocumentCheck = { id: string; label: string; ready: boolean };

export const DOCUMENT_CHECKLIST: readonly DocumentCheck[] = [
  { id: 'doc-transcript', label: 'Academic transcript', ready: true },
  { id: 'doc-cv', label: 'CV', ready: true },
  { id: 'doc-statement', label: 'Personal statement', ready: false },
  { id: 'doc-recommendation', label: 'Recommendation letter', ready: false },
  { id: 'doc-english', label: 'English test certificate', ready: true },
];

export type ReadinessItem = { id: string; label: string };

export const READINESS_CHECKLISTS: Record<'requirements' | 'completeness' | 'consistency' | 'final', readonly ReadinessItem[]> = {
  requirements: [
    { id: 'req-alevels', label: 'A-Level subjects match Cambridge Engineering requirements' },
    { id: 'req-admissions-test', label: 'Admissions test registered' },
    { id: 'req-english', label: 'English requirement met' },
  ],
  completeness: [
    { id: 'complete-transcript', label: 'Transcript uploaded' },
    { id: 'complete-cv', label: 'CV finalised' },
    { id: 'complete-statement', label: 'Personal statement finalised' },
    { id: 'complete-recommendation', label: 'Recommendation letter received' },
  ],
  consistency: [
    { id: 'consistent-dates', label: 'Dates match across CV and statement' },
    { id: 'consistent-name', label: 'Name and details match across all documents' },
  ],
  final: [
    { id: 'final-requirements', label: 'Entry requirements reviewed' },
    { id: 'final-statement', label: 'Personal statement drafted' },
    { id: 'final-cv', label: 'CV reflects your strongest evidence' },
    { id: 'final-recommender', label: 'Recommender confirmed' },
    { id: 'final-test', label: 'Admissions test registration confirmed' },
  ],
};
