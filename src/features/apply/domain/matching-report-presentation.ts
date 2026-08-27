import { fitScoreToPercent } from '@/shared/evaluation/f5-programme-fit';
import type { ProgrammeFit } from './ai-reports';

/**
 * Matching Report — presentation derivations.
 *
 * The report layout (docs/strategy-reports-spec.md) asks for percentages, a
 * headline band, an ordered fit breakdown and a tiered gap analysis. None of
 * that is stored: it is all derived from the one `ProgrammeFit` record. Deriving
 * it here rather than inside the view keeps it testable and stops two
 * components disagreeing about the same student's numbers.
 *
 * ─── THE PERCENTAGE IS ALIGNMENT, NOT LIKELIHOOD ─────────────────────────────
 *
 * `matchPercent` is a weighted rubric score rendered as a percentage of
 * alignment between profile and programme. Core principle 7 forbids emitting an
 * admissions probability and that still holds. Every label this module produces
 * is deliberately worded to avoid "chance", "odds" and "likelihood" — if you
 * add one, keep that property. `MATCH_SCORE_DISCLAIMER` exists so the caption
 * cannot drift away from the number it explains.
 */

export const MATCH_SCORE_DISCLAIMER =
  'This measures how closely your profile aligns with what this programme looks for. It is not a prediction of whether you will be admitted.';

export const DIMENSION_ORDER = [
  'academicCompetitiveness',
  'personaAlignment',
  'careerDirection',
  'financialFeasibility',
  'applicationReadiness',
] as const;

export type DimensionKey = (typeof DIMENSION_ORDER)[number];

/**
 * Display names and the one-line "Meaning" column from the report layout.
 *
 * The layout's mock splits "Programme Fit" and "Values Fit" into two rows, but
 * both are scored by the single `personaAlignment` dimension, so they are one
 * row here. Splitting them for real needs a sixth weighted dimension — recorded
 * as an open question in docs/strategy-reports-spec.md.
 */
export const DIMENSION_META: Record<DimensionKey, { label: string; meaning: string }> = {
  academicCompetitiveness: {
    label: 'Academic fit',
    meaning: 'Grades, coursework and academic achievements against what this programme expects',
  },
  personaAlignment: {
    label: 'Programme and values fit',
    meaning: 'How your experiences, interests and motivations line up with how this course teaches',
  },
  careerDirection: {
    label: 'Career vision fit',
    meaning: 'Whether where this programme leads matches where you have said you want to go',
  },
  financialFeasibility: {
    label: 'Financial feasibility',
    meaning: 'Cost against your stated budget and the funding realistically available',
  },
  applicationReadiness: {
    label: 'Application readiness',
    meaning: 'How much of the application itself is ready — tests, documents, portfolio',
  },
};

export type ClassificationTone = 'safe' | 'recommend' | 'reach' | 'neutral' | 'blocked';

export const CLASSIFICATION_META: Record<
  ProgrammeFit['classification'],
  { label: string; tone: ClassificationTone; meaning: string }
> = {
  safety: {
    label: 'Safety',
    tone: 'safe',
    meaning: 'Your academic standing sits clearly above this programme’s usual admitted range.',
  },
  strong_match: {
    label: 'Strong match',
    tone: 'safe',
    meaning: 'You sit comfortably inside this programme’s usual admitted range.',
  },
  match: {
    label: 'Match',
    tone: 'recommend',
    meaning: 'You sit within this programme’s usual admitted range.',
  },
  reach: {
    label: 'Reach',
    tone: 'reach',
    meaning:
      'Your academic standing is below this programme’s usual admitted range. You can still apply.',
  },
  currently_ineligible: {
    label: 'Currently ineligible',
    tone: 'blocked',
    meaning:
      'One or more entry requirements are not met yet. This is about eligibility, not about how strong you are.',
  },
  insufficient_data: {
    label: 'Not enough data to place you',
    tone: 'neutral',
    meaning:
      'This programme publishes no usable admitted-grade range, so we will not guess at a band.',
  },
};

/** "High / Moderate / Emerging", the opening of the layout's fit statement. */
export type AlignmentLevel = 'High' | 'Moderate' | 'Emerging' | 'Not assessed';

export function alignmentLevel(matchPercent: number | null): AlignmentLevel {
  if (matchPercent === null) return 'Not assessed';
  if (matchPercent >= 70) return 'High';
  if (matchPercent >= 40) return 'Moderate';
  return 'Emerging';
}

export type FitRow = {
  key: DimensionKey;
  label: string;
  meaning: string;
  /** null means not assessed — render as such, never as 0%. */
  percent: number | null;
  score: number | null;
  assessed: boolean;
  summary: string;
  strengths: string[];
  gaps: string[];
  limitation: string | null;
};

export function fitRows(fit: ProgrammeFit): FitRow[] {
  return DIMENSION_ORDER.map((key) => {
    const dimension = fit.dimensions[key];
    const assessed = dimension.status !== 'not_available' && dimension.score !== null;
    return {
      key,
      label: DIMENSION_META[key].label,
      meaning: DIMENSION_META[key].meaning,
      percent: assessed ? fitScoreToPercent(dimension.score) : null,
      score: dimension.score,
      assessed,
      summary: dimension.summary,
      strengths: dimension.strengths,
      gaps: dimension.gaps,
      limitation: dimension.limitation ?? null,
    };
  });
}

/**
 * The overall match percentage, computed the same way the shared engine does so
 * the two paths cannot disagree. Returns null when nothing was assessed —
 * distinct from a genuine zero.
 */
export const F5_WEIGHTS_BY_KEY: Record<DimensionKey, number> = {
  academicCompetitiveness: 0.25,
  personaAlignment: 0.25,
  careerDirection: 0.2,
  financialFeasibility: 0.15,
  applicationReadiness: 0.15,
};

export function overallMatchPercent(fit: ProgrammeFit): number | null {
  const present = DIMENSION_ORDER.filter((key) => {
    const dimension = fit.dimensions[key];
    return dimension.status !== 'not_available' && dimension.score !== null;
  });
  if (present.length === 0) return null;

  const totalWeight = present.reduce((sum, key) => sum + F5_WEIGHTS_BY_KEY[key], 0);
  if (totalWeight <= 0) return null;

  const score = present.reduce((sum, key) => {
    const value = fit.dimensions[key].score ?? 0;
    return sum + value * (F5_WEIGHTS_BY_KEY[key] / totalWeight);
  }, 0);

  return fitScoreToPercent(score);
}

export function readinessPercent(fit: ProgrammeFit): number | null {
  const dimension = fit.dimensions.applicationReadiness;
  if (dimension.status === 'not_available' || dimension.score === null) return null;
  return fitScoreToPercent(dimension.score);
}

export type EligibilityRow = {
  key: string;
  label: string;
  status: 'met' | 'not_met' | 'unknown';
  statusLabel: string;
  /** Only a hard `not_met` is a blocker. `unknown` means we could not check. */
  blocking: boolean;
};

const ELIGIBILITY_LABELS: Record<keyof ProgrammeFit['eligibility'], string> = {
  requiredSubjects: 'Required subjects',
  minimumQualification: 'Minimum qualification',
  languageRequirement: 'Language requirement',
  citizenshipRequirement: 'Citizenship or residency',
  deadline: 'Application deadline',
};

export function eligibilityRows(fit: ProgrammeFit): EligibilityRow[] {
  return (Object.keys(ELIGIBILITY_LABELS) as Array<keyof ProgrammeFit['eligibility']>).map(
    (key) => {
      const status = fit.eligibility[key];
      return {
        key,
        label: ELIGIBILITY_LABELS[key],
        status,
        statusLabel:
          status === 'met' ? 'Met' : status === 'not_met' ? 'Not met' : 'We could not check this',
        blocking: status === 'not_met',
      };
    },
  );
}

export type GapTier = 'critical' | 'competitive';

export type GapEntry = {
  tier: GapTier;
  dimension: string;
  text: string;
};

/**
 * Gap tiering, from the layout's Critical / Competitive split.
 *
 * A gap on a dimension that is both heavily weighted and currently weak is
 * critical; everything else is competitive — worth doing, but not what is
 * holding the application back. The layout also has a "Hidden risks" tier,
 * which needs cross-activity signals the fit record does not carry; it is
 * sourced separately rather than faked from these gaps.
 */
export function tieredGaps(fit: ProgrammeFit, limit = 3): GapEntry[] {
  const entries: GapEntry[] = [];
  for (const key of DIMENSION_ORDER) {
    const dimension = fit.dimensions[key];
    const weight = F5_WEIGHTS_BY_KEY[key];
    const weak = dimension.score !== null && dimension.score < 3;
    const tier: GapTier = weak && weight >= 0.2 ? 'critical' : 'competitive';
    for (const gap of dimension.gaps) {
      entries.push({ tier, dimension: DIMENSION_META[key].label, text: gap });
    }
  }
  const critical = entries.filter((entry) => entry.tier === 'critical').slice(0, limit);
  const competitive = entries.filter((entry) => entry.tier === 'competitive').slice(0, limit);
  return [...critical, ...competitive];
}

/** Everything the summary band needs, in one derivation. */
export type MatchSummary = {
  classification: ProgrammeFit['classification'];
  label: string;
  tone: ClassificationTone;
  meaning: string;
  matchPercent: number | null;
  readinessPercent: number | null;
  confidencePercent: number;
  alignment: AlignmentLevel;
  blockingRequirements: EligibilityRow[];
};

export function matchSummary(fit: ProgrammeFit): MatchSummary {
  const meta = CLASSIFICATION_META[fit.classification];
  const percent = overallMatchPercent(fit);
  return {
    classification: fit.classification,
    label: meta.label,
    tone: meta.tone,
    meaning: meta.meaning,
    matchPercent: percent,
    readinessPercent: readinessPercent(fit),
    confidencePercent: fit.confidence,
    alignment: alignmentLevel(percent),
    blockingRequirements: eligibilityRows(fit).filter((row) => row.blocking),
  };
}
import type { MatchingReportV2 } from '@/lib/ai/matching/domain';

export function getV2Sections(report: MatchingReportV2) {
  return {
    snapshot: report.overall,
    criticalRequirements: report.academicRequirements,
    strengths: report.strengths,
    gaps: report.gaps,
    criteriaBreakdown: report.programmeAlignment,
    opportunities: report.positioningOpportunities,
    scholarship: report.scholarshipAlignment,
    evidenceNeeded: report.gaps.filter(
      (g) => g.type === 'missing_evidence' || g.type === 'weak_evidence' || g.evidenceNeeded.length > 0,
    ),
  };
}
