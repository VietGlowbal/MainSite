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
  | 'match'
  | 'reach'
  | 'currently_ineligible'
  | 'insufficient_data';

export type ProgrammeFitResult = Insight & {
  classification: ProgrammeFitClassification;
  eligibility: ProgrammeFitEligibility;
  dimensions: Record<F5DimensionKey, F5Dimension>;
};

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
