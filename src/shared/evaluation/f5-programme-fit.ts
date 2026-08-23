import type { Confidence, EvidenceRef, Insight } from './types';

/**
 * F5 — Programme Fit Framework.
 *
 * ─── INTERFACES ONLY IN THIS PHASE ───────────────────────────────────────────
 *
 * F5 will be completed in the Matching Report phase. This file exists so the
 * `ProfileEvaluation` shape (see engine.ts) has a stable slot for it now and
 * nothing downstream has to be restructured when F5 is implemented — but no
 * scoring logic lives here yet. `buildProgrammeFitPlaceholder` is the only
 * function, and it always returns `not_available`.
 *
 * The five dimensions named here match the existing `programmeFitSchema` in
 * `src/features/apply/domain/ai-reports.ts` (academic competitiveness,
 * persona-programme alignment, financial feasibility, career direction
 * alignment, application readiness) — that shape is reused rather than
 * redefined, since it already satisfies core principle 6 (a missing
 * dimension is `not_available` with a null score, never a fabricated value)
 * and core principle 7 (no admissions probability, ever).
 */

export const F5_DIMENSION_KEYS = [
  'academicCompetitiveness',
  'personaAlignment',
  'financialFeasibility',
  'careerDirection',
  'applicationReadiness',
] as const;

export type F5DimensionKey = (typeof F5_DIMENSION_KEYS)[number];

export type F5DimensionStatus = 'assessed' | 'limited' | 'not_available';

export type F5Dimension = {
  status: F5DimensionStatus;
  /** 1-5, null when `status` is `not_available`. */
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

export type ProgrammeFitClassification =
  | 'safety'
  | 'strong_match'
  | 'match'
  | 'reach'
  | 'currently_ineligible'
  | 'insufficient_data';

export const F5_DIMENSION_WEIGHTS: Record<F5DimensionKey, number> = {
  academicCompetitiveness: 0.25,
  personaAlignment: 0.25,
  careerDirection: 0.20,
  financialFeasibility: 0.15,
  applicationReadiness: 0.15,
};

export function fitScoreToPercent(score: number): number {
  return Math.round(((Math.min(5, Math.max(1, score)) - 1) / 4) * 100);
}

export type ProgrammeFitResult = Insight & {
  classification: ProgrammeFitClassification;
  eligibility: ProgrammeFitEligibility;
  dimensions: Record<F5DimensionKey, F5Dimension>;
  compositeScore: number | null;
};

/**
 * Calculates F5 Programme Fit classification and composite score from dimension assessments.
 */
export function evaluateProgrammeFit(args: {
  eligibility: ProgrammeFitEligibility;
  dimensions: Record<F5DimensionKey, F5Dimension>;
  confidence?: Confidence;
}): ProgrammeFitResult {
  const { eligibility, dimensions, confidence = 'medium' } = args;

  // Reject invalid scores loudly before any branch runs — a fabricated or
  // corrupt score must never silently flow into a classification, even on the
  // hard-gate path. The AI-output Zod schema enforces the same range upstream;
  // this guard keeps the pure engine safe for callers that bypass it.
  for (const [key, dim] of Object.entries(dimensions)) {
    if (!dim || dim.score === null) continue;
    if (!Number.isFinite(dim.score) || dim.score < 1 || dim.score > 5) {
      throw new TypeError(`F5 dimension "${key}" score must be a finite number between 1 and 5`);
    }
  }

  // Every unassessed key, computed once — early branches must report the
  // complete gap list, not just the single dimension that triggered them.
  const missingInputs: F5DimensionKey[] = F5_DIMENSION_KEYS.filter((key) => {
    const dim = dimensions[key];
    return !dim || dim.status === 'not_available' || dim.score === null;
  });

  const hardFilters = Object.values(eligibility);
  if (hardFilters.includes('not_met')) {
    return {
      id: 'f5:evaluated',
      frameworkId: 'F5',
      status: 'complete',
      score: null,
      compositeScore: null,
      confidence,
      kind: 'observation',
      evidenceRefs: Object.values(dimensions).flatMap((d) => d.evidenceRefs),
      limitations: [],
      missingInputs: [],
      classification: 'currently_ineligible',
      eligibility,
      dimensions,
    };
  }

  const academic = dimensions.academicCompetitiveness;
  if (!academic || academic.status === 'not_available' || academic.score === null) {
    return {
      id: 'f5:evaluated',
      frameworkId: 'F5',
      status: 'partial',
      score: null,
      compositeScore: null,
      confidence: 'low',
      kind: 'missing',
      evidenceRefs: Object.values(dimensions).flatMap((d) => d.evidenceRefs),
      limitations: ['Academic competitiveness data is required to classify programme fit.'],
      missingInputs,
      classification: 'insufficient_data',
      eligibility,
      dimensions,
    };
  }

  let totalAssessedWeight = 0;
  let weightedScoreSum = 0;

  for (const [key, weight] of Object.entries(F5_DIMENSION_WEIGHTS) as Array<[F5DimensionKey, number]>) {
    const dim = dimensions[key];
    // Missing keys are already listed in the pre-computed `missingInputs`.
    if (dim && dim.status !== 'not_available' && dim.score !== null) {
      totalAssessedWeight += weight;
      weightedScoreSum += dim.score * weight;
    }
  }

  const compositeScore = totalAssessedWeight > 0 ? weightedScoreSum / totalAssessedWeight : null;

  let classification: ProgrammeFitClassification;
  if (academic.score >= 4.5) {
    classification = 'safety';
  } else if (academic.score >= 3.5) {
    classification = 'strong_match';
  } else if (academic.score >= 2.5) {
    classification = 'match';
  } else {
    classification = 'reach';
  }

  return {
    id: 'f5:evaluated',
    frameworkId: 'F5',
    status: missingInputs.length > 0 ? 'partial' : 'complete',
    score: compositeScore !== null ? Math.round(compositeScore * 20) : null, // 0-100 scale for base Insight
    compositeScore,
    confidence,
    kind: 'observation',
    evidenceRefs: Object.values(dimensions).flatMap((d) => d.evidenceRefs),
    limitations: [],
    missingInputs,
    classification,
    eligibility,
    dimensions,
  };
}

/**
 * The placeholder every consumer of `ProfileEvaluation` gets until the
 * Matching Report phase implements F5 for real. Every dimension is
 * `not_available` — never a guessed value — and the classification is
 * `insufficient_data`, which is itself a real, honest classification per the
 * existing schema (not an error state).
 */
export function buildProgrammeFitPlaceholder(): ProgrammeFitResult {
  const emptyDimension: F5Dimension = {
    status: 'not_available',
    score: null,
    summary: '',
    strengths: [],
    gaps: [],
    evidenceRefs: [],
    limitation: 'F5 is not yet implemented — see the Matching Report phase.',
  };

  const dimensions = {} as Record<F5DimensionKey, F5Dimension>;
  for (const key of F5_DIMENSION_KEYS) dimensions[key] = { ...emptyDimension };

  return {
    id: 'f5:placeholder',
    frameworkId: 'F5',
    status: 'not_implemented',
    score: null,
    compositeScore: null,
    confidence: 'low' as Confidence,
    kind: 'missing',
    evidenceRefs: [],
    limitations: ['F5 Programme Fit is not yet implemented in this engine.'],
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
  };
}
