/**
 * The GlowBal Shared Evaluation Engine — core types.
 *
 * ─── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * One canonical implementation of the F1–F6 evaluation frameworks, living in
 * `shared` rather than any one feature, because the Personal Report (feature
 * `apply`), the Matching Report and Strategy Report (feature
 * `ai-strategy-dashboard`) all need to read the same evaluation of the same
 * student — and eslint's cross-feature-import rule means no feature can import
 * another's domain code. `shared` is the one leaf every feature may depend on.
 *
 * This module is pure: no I/O, no React, no framework imports, no network
 * calls. Every framework that can be computed deterministically from
 * structured input IS computed deterministically — see the module-level
 * comments on each framework file for which of the ten core principles it is
 * satisfying and how.
 *
 * ─── CORE PRINCIPLES (see docs/ai-evaluation-engine.md for the long version) ──
 *
 *  1. Evidence first — every score traces to something the student entered.
 *  2. Never invent missing applicant facts.
 *  3. Observation / Inference / Missing are always distinguished.
 *  4. Assumptions are never allowed IN SCORING (a limitation is not a score).
 *  5. Every important inference carries evidenceRefs + confidence.
 *  6. A missing metric is `null`, not zero, and its weight is redistributed.
 *  7. No admissions probability is ever computed, anywhere in this engine.
 *  8. Deterministic logic stays deterministic — no framework here calls a
 *     model unless the file's own header says otherwise.
 *  9. Where a model IS used, it is confined to genuinely semantic judgement or
 *     extraction (see src/lib/ai/evaluation), never to scoring or arithmetic.
 * 10. The engine's output is a structured object first; prose is a rendering
 *     of it, not the record of it.
 */

/** How much of a finding rests on real input rather than a thin signal. */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Every framework's confidence is derived the same way: the share of expected
 * inputs that were actually present and usable. See each framework for what
 * "usable" means there — F6's vagueness verdict, F3's evidence tier, etc.
 */
export function confidenceFromCoverage(present: number, total: number): Confidence {
  if (total <= 0) return 'low';
  const ratio = present / total;
  if (ratio >= 0.75) return 'high';
  if (ratio >= 0.4) return 'medium';
  return 'low';
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * The floor, not the mean. A profile with three well-evidenced achievements
 * and one vague reflection is not "medium confidence overall" — it is a
 * profile whose narrative sections rest on nothing, and averaging that away
 * would hide exactly the thing a student needs to fix.
 */
export function lowestConfidence(values: readonly Confidence[]): Confidence {
  if (values.length === 0) return 'low';
  return values.reduce((worst, value) =>
    CONFIDENCE_RANK[value] < CONFIDENCE_RANK[worst] ? value : worst,
  );
}

/**
 * Every framework in this engine, in pipeline order. F5 is Programme Fit,
 * built as interfaces only in this phase — see f5-programme-fit.ts. F4's six
 * sub-frameworks are their own ids so an Insight can name exactly which
 * sub-analysis produced it.
 */
export const FRAMEWORKS = [
  'F6',
  'F1',
  'F2',
  'F3',
  'F4',
  'F4.1',
  'F4.2',
  'F4.3',
  'F4.4',
  'F4.5',
  'F4.6',
  'F5',
] as const;

export type FrameworkId = (typeof FRAMEWORKS)[number];

/**
 * Whether a finding is something the data directly says (`observation`),
 * something derived across more than one data point (`inference`), or
 * something that could not be determined at all (`missing`).
 *
 * This is the classification core principle 3 requires everywhere. An
 * `inference` is never rendered with the same certainty as an `observation` —
 * every consumer of an Insight must branch on `kind` before deciding how
 * confidently to state it.
 */
export type ObservationKind = 'observation' | 'inference' | 'missing';

/** A pointer to the one place a claim can be checked — never a paraphrase. */
export type EvidenceRef = {
  id: string;
  /** What kind of record this points at — achievement, activity, document, profile field, test score. */
  kind: string;
  /** Human label for the report, e.g. "National maths olympiad, 2025". */
  label: string;
};

/**
 * The shape every framework's output is built from. Concrete framework
 * results extend this with their own fields (dimensions, metrics, findings),
 * but every one of them carries these eight — core principle 5's contract in
 * type form.
 *
 * `score` is optional and nullable on purpose: a fundamentally qualitative
 * output (F4.1's identity description, F6's findings) must not be forced into
 * a number it cannot honestly carry. See framework files for which ones omit
 * it entirely versus set it null when unassessed.
 */
export type Insight = {
  id: string;
  frameworkId: FrameworkId;
  status: string;
  score?: number | null;
  confidence: Confidence;
  kind: ObservationKind;
  evidenceRefs: EvidenceRef[];
  limitations: string[];
  missingInputs: string[];
};

/** Build an Insight, defaulting the list fields to empty rather than requiring every caller to spell them out. */
export function makeInsight(
  insight: Omit<Insight, 'evidenceRefs' | 'limitations' | 'missingInputs'> &
    Partial<Pick<Insight, 'evidenceRefs' | 'limitations' | 'missingInputs'>>,
): Insight {
  return {
    evidenceRefs: [],
    limitations: [],
    missingInputs: [],
    ...insight,
  };
}
