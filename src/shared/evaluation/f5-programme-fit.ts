import { confidenceFromCoverage, type Confidence, type EvidenceRef, type Insight } from './types';
import { weightedScore, type WeightedMetric } from './weighted-score';

/**
 * F5 — Programme Fit & Reach/Match/Safety Framework.
 *
 * ─── WHAT CHANGED ────────────────────────────────────────────────────────────
 *
 * This file used to be interfaces only: `buildProgrammeFitPlaceholder` returned
 * `not_available` for every dimension so that `ProfileEvaluation` had a stable
 * slot while the Matching Report phase was still unscheduled. That phase is now
 * in progress, so the scoring, the renormalization and the classification rule
 * are implemented here. The placeholder is KEPT and still exported, because
 * `runProfileEvaluation` legitimately runs without a programme attached — a
 * Personal Report is user-level and has no target course to be assessed
 * against. Absent programme input is "not assessed", never a zero.
 *
 * ─── THE TWO HALVES ARE DELIBERATELY NOT THE SAME MECHANISM ──────────────────
 *
 * A student asks two different questions about a course, and conflating them
 * is the single most damaging thing this framework could do:
 *
 *   1. "Am I ALLOWED to apply?"  — hard eligibility. Binary, per requirement.
 *   2. "How do I COMPARE?"       — graded fit across five dimensions.
 *
 * So eligibility is a set of gates evaluated before any arithmetic, and it can
 * only ever produce `currently_ineligible`. It never nudges a score. And the
 * Reach/Match/Safety band is decided by the ACADEMIC band alone once the gates
 * pass — persona alignment, money and career direction are reported beside the
 * label but must never move it. A student who is academically below a
 * programme's range does not become a "Match" because their values align well;
 * telling them otherwise is how someone wastes an application fee.
 *
 * ─── NO ADMISSION PROBABILITY, AND WHY THE PERCENTAGE IS STILL FINE ──────────
 *
 * Core principle 7 forbids emitting an admissions probability, and that has not
 * been relaxed. `fitScoreToPercent` converts a 1-5 rubric score into a
 * percentage of ALIGNMENT — how well profile and programme correspond on the
 * measured dimensions. That is not a chance of being admitted, and no caller may
 * label or describe it as likelihood, odds or chance. The distinction lives in
 * the copy as much as the code; see docs/strategy-reports-spec.md.
 */

export const F5_DIMENSION_KEYS = [
  'academicCompetitiveness',
  'personaAlignment',
  'financialFeasibility',
  'careerDirection',
  'applicationReadiness',
] as const;

export type F5DimensionKey = (typeof F5_DIMENSION_KEYS)[number];

/**
 * Weights from the owner's framework document, section 4. They sum to 1.
 *
 * Application readiness is weighted LOWEST of the five despite being the most
 * consequential input, which looks wrong until you notice it is double-counted
 * on purpose: it is really a hard gate (handled by `eligibility` above the
 * scoring entirely), and the scored dimension only captures the softer part —
 * portfolio, tests, how prepared the application itself is. Giving it a heavy
 * scored weight as well would punish the same fact twice.
 */
export const F5_WEIGHTS: Record<F5DimensionKey, number> = {
  academicCompetitiveness: 0.25,
  personaAlignment: 0.25,
  financialFeasibility: 0.15,
  careerDirection: 0.2,
  applicationReadiness: 0.15,
};

export type F5DimensionStatus = 'assessed' | 'limited' | 'not_available';

export type F5Dimension = {
  status: F5DimensionStatus;
  /** 1-5, null when `status` is `not_available`. Fractional values are allowed — see `fitScoreToPercent`. */
  score: number | null;
  summary: string;
  strengths: string[];
  gaps: string[];
  evidenceRefs: EvidenceRef[];
  limitation?: string;
};

export type ProgrammeFitEligibility = {
  requiredSubjects: 'met' | 'not_met' | 'unknown';
  minimumQualification: 'met' | 'not_met' | 'unknown';
  languageRequirement: 'met' | 'not_met' | 'unknown';
  citizenshipRequirement: 'met' | 'not_met' | 'unknown';
  deadline: 'met' | 'not_met' | 'unknown';
};

export const ELIGIBILITY_KEYS = [
  'requiredSubjects',
  'minimumQualification',
  'languageRequirement',
  'citizenshipRequirement',
  'deadline',
] as const;

export type EligibilityKey = (typeof ELIGIBILITY_KEYS)[number];

export type ProgrammeFitClassification =
  | 'safety'
  | 'strong_match'
  | 'match'
  | 'reach'
  | 'currently_ineligible'
  | 'insufficient_data';

/**
 * Where the applicant's academic standing sits against the programme's own
 * typical admitted range. `unknown` is a first-class outcome: most catalogue
 * rows carry no usable admitted range, and guessing one is exactly the failure
 * `docs/known-issues.md §1a` exists to prevent.
 */
export type AcademicBand = 'above_range' | 'upper_range' | 'lower_range' | 'below_range' | 'unknown';

export type ProgrammeFitResult = Insight & {
  classification: ProgrammeFitClassification;
  eligibility: ProgrammeFitEligibility;
  dimensions: Record<F5DimensionKey, F5Dimension>;
  academicBand: AcademicBand;
  /** 0-100 alignment, or null when nothing could be scored. NOT a probability of admission. */
  matchPercent: number | null;
  /** 0-100 from the application-readiness dimension alone, or null when unassessed. */
  readinessPercent: number | null;
  /** 0-100, the share of the five dimensions that could actually be assessed. */
  confidencePercent: number;
  /** Which eligibility gates the applicant currently fails. Empty unless `currently_ineligible`. */
  failedGates: EligibilityKey[];
};

/**
 * Rubric score (1-5) to a 0-100 percentage.
 *
 * `(score - 1) / 4` rather than `score / 5`, so the full range is usable and a
 * genuine 1-out-of-5 reads as 0% rather than a misleadingly encouraging 20%. A
 * dimension that could not be assessed is `null` and renders as "not assessed",
 * never as 0% — the two mean opposite things to a student.
 */
export function fitScoreToPercent(score: number | null): number | null {
  if (score === null) return null;
  const clamped = Math.min(5, Math.max(1, score));
  return Math.round(((clamped - 1) / 4) * 100);
}

export type ProgrammeFitInput = {
  eligibility: ProgrammeFitEligibility;
  academicBand: AcademicBand;
  dimensions: Record<F5DimensionKey, F5Dimension>;
};

/**
 * Hard gates, evaluated before any arithmetic. Only an explicit `not_met`
 * fails: `unknown` means we could not check, and treating "not checked" as
 * "not met" would tell a student they are ineligible for a course they can
 * apply to — the mirror image of the tick-mark problem the Programme Fit page
 * has always refused to draw.
 */
function failedEligibilityGates(eligibility: ProgrammeFitEligibility): EligibilityKey[] {
  return ELIGIBILITY_KEYS.filter((key) => eligibility[key] === 'not_met');
}

function classify(
  academicBand: AcademicBand,
  academicAssessed: boolean,
  failedGates: readonly EligibilityKey[],
): ProgrammeFitClassification {
  // Overrides everything, per the framework document's classification rule.
  if (failedGates.length > 0) return 'currently_ineligible';
  if (!academicAssessed || academicBand === 'unknown') return 'insufficient_data';

  switch (academicBand) {
    case 'above_range':
      return 'safety';
    case 'upper_range':
      return 'strong_match';
    case 'lower_range':
      return 'match';
    case 'below_range':
      return 'reach';
  }
}

/** Human-readable disclosure of which dimensions were dropped and reweighted. */
function renormalizationLimitation(missingKeys: readonly string[]): string {
  const names = missingKeys.join(', ');
  return `Not enough information to assess ${names}. The remaining dimensions were reweighted so the match score still sums correctly; it is not a penalty for the missing ones.`;
}

export function assessProgrammeFit(input: ProgrammeFitInput): ProgrammeFitResult {
  const { eligibility, academicBand, dimensions } = input;

  const metrics: WeightedMetric[] = F5_DIMENSION_KEYS.map((key) => ({
    key,
    weight: F5_WEIGHTS[key],
    value: dimensions[key].status === 'not_available' ? null : dimensions[key].score,
  }));

  const weighted = weightedScore(metrics);
  const failedGates = failedEligibilityGates(eligibility);
  const academic = dimensions.academicCompetitiveness;
  const academicAssessed = academic.status !== 'not_available' && academic.score !== null;

  const classification = classify(academicBand, academicAssessed, failedGates);

  const assessedCount = F5_DIMENSION_KEYS.filter(
    (key) => dimensions[key].status !== 'not_available',
  ).length;

  const limitations: string[] = [];
  if (weighted.renormalized) limitations.push(renormalizationLimitation(weighted.missingKeys));
  if (academicBand === 'unknown' && failedGates.length === 0) {
    limitations.push(
      'This programme publishes no usable admitted-grade range, so we cannot place you as Reach, Match or Safety. The dimensions below are still scored.',
    );
  }
  for (const key of F5_DIMENSION_KEYS) {
    const limitation = dimensions[key].limitation;
    if (limitation) limitations.push(limitation);
  }

  const evidenceRefs = F5_DIMENSION_KEYS.flatMap((key) => dimensions[key].evidenceRefs);

  return {
    id: 'f5:programme-fit',
    frameworkId: 'F5',
    status: classification === 'insufficient_data' ? 'insufficient_data' : 'assessed',
    score: weighted.score,
    confidence: confidenceFromCoverage(assessedCount, F5_DIMENSION_KEYS.length),
    kind: weighted.score === null ? 'missing' : 'inference',
    evidenceRefs,
    limitations,
    missingInputs: weighted.missingKeys,
    classification,
    eligibility,
    dimensions,
    academicBand,
    matchPercent: fitScoreToPercent(weighted.score),
    readinessPercent: fitScoreToPercent(
      dimensions.applicationReadiness.status === 'not_available'
        ? null
        : dimensions.applicationReadiness.score,
    ),
    confidencePercent: Math.round((assessedCount / F5_DIMENSION_KEYS.length) * 100),
    failedGates,
  };
}
export function buildProgrammeFitPlaceholder(): ProgrammeFitResult {
  const emptyDimension: F5Dimension = {
    status: 'not_available',
    score: null,
    summary: '',
    strengths: [],
    gaps: [],
    evidenceRefs: [],
    limitation: 'No target programme is attached to this evaluation.',
  };

  const dimensions = {} as Record<F5DimensionKey, F5Dimension>;
  for (const key of F5_DIMENSION_KEYS) dimensions[key] = { ...emptyDimension };

  return {
    id: 'f5:placeholder',
    frameworkId: 'F5',
    status: 'not_assessed',
    score: null,
    confidence: 'low' as Confidence,
    kind: 'missing',
    evidenceRefs: [],
    limitations: ['Programme Fit is assessed per application, and none is attached here.'],
    missingInputs: [...F5_DIMENSION_KEYS],
    classification: 'insufficient_data',
    eligibility: {
      requiredSubjects: 'unknown',
      minimumQualification: 'unknown',
      languageRequirement: 'unknown',
      citizenshipRequirement: 'unknown',
      deadline: 'unknown',
    },
    dimensions,
    academicBand: 'unknown',
    matchPercent: null,
    readinessPercent: null,
    confidencePercent: 0,
    failedGates: [],
  };
}
