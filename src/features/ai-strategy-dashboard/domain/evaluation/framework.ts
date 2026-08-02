/**
 * The Shared Evaluation Engine — framework identities.
 *
 * ─── WHAT THIS ENGINE IS ─────────────────────────────────────────────────────
 *
 * One evaluation of a student, run once, that every AI surface reads from:
 *
 *     Intake → F6 Vagueness Gate → F1 Reflection → F2 Competency
 *            → F3 Evidence → F4 Branding → F5 Programme Fit
 *
 *   AI 1 Report     renders it as the Applicant Portrait + Programme Fit pages
 *   AI 2 Feedback   reads it and returns weaknesses + fixes against a rubric
 *   AI 3 Strategy   turns it into a roadmap                     (not built yet)
 *   AI 4 Breakdown  turns that roadmap into phases and deadlines (not built yet)
 *
 * Before this module there was no engine: `analyzeApplicant` and
 * `analyzeCourseMatchInsights` were two unrelated OpenAI calls that could — and
 * did — disagree about the same student, because nothing made them share a
 * reading. Anything added later (Feedback, Strategy, Breakdown) would have been
 * a third and fourth opinion. The point of a single result is that four
 * surfaces cannot contradict each other about a student's own profile.
 *
 * ─── WHAT IS AI AND WHAT IS NOT ──────────────────────────────────────────────
 *
 * Only F1 and F4 need a language model. They are the two that require
 * judgement about a person's story — what drives them, how they should be
 * positioned. Everything else is deterministic:
 *
 *   F2  a reshape of match-insights' pillar scores
 *   F3  a tiering of achievements the student already entered
 *   F5  a reshape of the same pillars against the university row
 *   F6  text heuristics
 *
 * That split is deliberate and worth keeping. A deterministic framework is
 * testable, free, instant, and cannot hallucinate — and three of these four are
 * counting and sorting facts the student typed in, which is the last thing that
 * should be delegated to a model. Every framework here that CAN be pure IS
 * pure.
 */

/** The six frameworks, in pipeline order. */
export const FRAMEWORKS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const;
export type FrameworkId = (typeof FRAMEWORKS)[number];

export type FrameworkMeta = {
  id: FrameworkId;
  /** The name used in the product spec, kept verbatim so the two can be matched. */
  name: string;
  /** Whether this framework's output comes from a model or is derived. */
  source: 'ai' | 'derived';
};

export const FRAMEWORK_META: Record<FrameworkId, FrameworkMeta> = {
  F1: { id: 'F1', name: 'CMCAITF Reflection Framework', source: 'ai' },
  F2: { id: 'F2', name: 'Admissions Competency Framework', source: 'derived' },
  F3: { id: 'F3', name: 'Evidence Hierarchy Framework', source: 'derived' },
  F4: { id: 'F4', name: 'Narrative Identity & Personal Branding Framework', source: 'ai' },
  F5: { id: 'F5', name: 'Programme Fit Framework', source: 'derived' },
  F6: { id: 'F6', name: 'Vagueness Gate', source: 'derived' },
};

/**
 * How much of the engine's answer rests on real input rather than inference.
 *
 * Carried on every framework's output and shown to the student, because a
 * portrait built from three sentences and one from a full profile with
 * documents attached should not look equally authoritative. This is the
 * difference between a report and a guess wearing a report's layout.
 */
export type Confidence = 'high' | 'medium' | 'low';

export function confidenceFromCoverage(present: number, total: number): Confidence {
  if (total === 0) return 'low';
  const ratio = present / total;
  if (ratio >= 0.75) return 'high';
  if (ratio >= 0.4) return 'medium';
  return 'low';
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Well evidenced',
  medium: 'Partly evidenced',
  low: 'Thin evidence',
};
