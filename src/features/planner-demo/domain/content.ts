import type { ConfidenceLevel } from './types';

/**
 * Static mock "AI output" for the task types that got a real GenUI build
 * beyond reflection and CV. All demo data (spec §"Lưu ý về nội dung
 * AI-generated") — none of it is a real Cambridge requirement, report, or
 * match calculation. Confidence levels are shown wherever content claims to
 * be AI-extracted, per CLAUDE.md's rule that AI-generated facts need a
 * visible confidence level rather than a bare claim.
 */

export type EntryRequirement = { label: string; detail: string };

export const ENTRY_REQUIREMENTS: readonly EntryRequirement[] = [
  { label: 'A-Levels', detail: 'A*A*A, including Mathematics and Physics' },
  { label: 'Admissions test', detail: 'ESAT (Engineering and Science Admissions Test)' },
  { label: 'Interview', detail: 'Two subject interviews at your assigned college, December' },
  { label: 'English requirement', detail: 'IELTS Academic 7.5, no band below 7.0' },
  { label: 'Application deadline', detail: '15 October (UCAS), the year before entry' },
];

export type ReportHighlight = { text: string; confidence: ConfidenceLevel };

export const PERSONAL_REPORT = {
  overallConfidence: 'medium' as ConfidenceLevel,
  strengths: [
    { text: 'Hands-on engineering project with a working prototype', confidence: 'high' as ConfidenceLevel },
    { text: 'Ownership of a full build, from design through deployment', confidence: 'high' as ConfidenceLevel },
    { text: 'Comfortable discussing technical trade-offs and calibration', confidence: 'medium' as ConfidenceLevel },
  ] satisfies ReportHighlight[],
  gaps: [
    { text: 'No admissions test practice logged yet', confidence: 'high' as ConfidenceLevel },
    { text: 'Academic transcript not yet reviewed for A*A*A tracking', confidence: 'low' as ConfidenceLevel },
  ] satisfies ReportHighlight[],
};

export type MatchResult = {
  score: number;
  tier: 'reach' | 'recommended' | 'safe';
  summary: string;
  confidence: ConfidenceLevel;
};

export const MATCH_RESULT: MatchResult = {
  score: 62,
  tier: 'reach',
  confidence: 'medium',
  summary:
    'Your project evidence is strong for Engineering, but we don’t have your predicted grades or ESAT prep yet — both move this number a lot.',
};

export type StrategyPriority = { title: string; detail: string };

export const STRATEGY_PRIORITIES: readonly StrategyPriority[] = [
  { title: 'Lock in ESAT prep', detail: 'Cambridge Engineering weighs this heavily — start 3 months out.' },
  { title: 'Add a second technical project', detail: 'One strong project reads as luck; two reads as a pattern.' },
  { title: 'Draft your personal statement early', detail: 'Give yourself time for two full redrafts before October.' },
  { title: 'Line up a recommender', detail: 'Ask your physics teacher now, before the autumn rush.' },
];

export type SuggestedAction = { id: string; title: string; detail: string };

export const PROFILE_ACTIONS: readonly SuggestedAction[] = [
  {
    id: 'action-transcript',
    title: 'Upload your latest transcript',
    detail: 'We’ll track your A*A*A progress against Cambridge’s offer automatically.',
  },
  {
    id: 'action-esat',
    title: 'Log an ESAT practice paper',
    detail: 'Even one timed paper gives your match score real signal instead of a guess.',
  },
  {
    id: 'action-second-project',
    title: 'Tell us about a second project',
    detail: 'A smaller one counts — anything with a build, a decision, and a result.',
  },
];

export const STATEMENT_SUGGESTION =
  'From the first time I short-circuited a breadboard trying to read a gas sensor, I understood that engineering is not about getting things right the first time — it’s about building a system that tells you when it’s wrong.';

export type ReadinessItem = { id: string; label: string };

export const READINESS_ITEMS: readonly ReadinessItem[] = [
  { id: 'ready-requirements', label: 'Entry requirements reviewed' },
  { id: 'ready-personal-statement', label: 'Personal statement drafted' },
  { id: 'ready-cv', label: 'CV reflects your strongest evidence' },
  { id: 'ready-recommender', label: 'Recommender confirmed' },
  { id: 'ready-esat', label: 'ESAT registration confirmed' },
];
