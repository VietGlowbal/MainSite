import type { MatchInputsPresent, PillarBreakdown, PillarKey } from '@/lib/match-insights';

/**
 * Course Match Analysis — the course-fit report (V2 Stage 3, Report 2).
 *
 * THIS RESHAPES `match-insights`, IT DOES NOT REPLACE IT. `match-insights.ts`
 * already scores five weighted pillars (academic/activities/essays/impact/
 * personal) with a current/max score, confidence and improvement actions,
 * persisted on `application_match_analyses`. What V2 asks for — Entry
 * Requirement Match, Experience Match, Personal Qualities Match, Missing
 * Areas, Admissions Risk, Admissions Confidence — is a relabelling and
 * regrouping of that same pillar breakdown for this report's layout, not a
 * second scoring model. `deriveCourseMatchAnalysis` is the one place that
 * mapping happens, so the report and any future consumer agree on it.
 */

export type CourseMatchSubScore = {
  label: string;
  /** 0-100, sourced from the pillar(s) this sub-score maps to. */
  score: number;
  pillars: PillarKey[];
};

export type CourseMatchAnalysis = {
  applicationId: string;
  /** Overall Match — requirements.md 7.1. Same figure as `current_match_score`. */
  overallMatchPercent: number;
  goalMatchPercent: number;
  entryRequirementMatch: CourseMatchSubScore;
  experienceMatch: CourseMatchSubScore;
  personalQualitiesMatch: CourseMatchSubScore;
  missingAreas: string[];
  admissionsRisk: string[];
  /** 0-100 — reuses match-insights' existing `confidence` figure. */
  admissionsConfidence: number;
  inputsPresent: MatchInputsPresent;
};

/**
 * The V2 sub-score → match-insights pillar mapping (requirements.md 7.1-7.2).
 * `essays` feeds Personal Qualities rather than Experience: match-insights
 * weights essays for how the student's story reads, which is closer to "how
 * do they come across" than to a track record of relevant experience.
 */
const SUB_SCORE_PILLARS: Record<'entryRequirement' | 'experience' | 'personalQualities', PillarKey[]> = {
  entryRequirement: ['academic'],
  experience: ['activities', 'impact'],
  personalQualities: ['essays', 'personal'],
};

function averageScore(pillars: Record<PillarKey, PillarBreakdown>, keys: PillarKey[]): number {
  const assessed = keys.map((key) => pillars[key]).filter((p) => p.assessed);
  if (assessed.length === 0) return 0;
  return Math.round(assessed.reduce((sum, p) => sum + p.current, 0) / assessed.length);
}

function subScore(
  label: string,
  pillars: Record<PillarKey, PillarBreakdown>,
  keys: PillarKey[],
): CourseMatchSubScore {
  return { label, score: averageScore(pillars, keys), pillars: keys };
}

export function deriveCourseMatchAnalysis(
  applicationId: string,
  pillars: Record<PillarKey, PillarBreakdown>,
  confidence: number,
  inputsPresent: MatchInputsPresent,
  overallMatchPercent: number,
  goalMatchPercent: number,
): CourseMatchAnalysis {
  const missingAreas = Object.values(pillars).flatMap((p) => p.gaps);
  const admissionsRisk = Object.values(pillars)
    .filter((p) => p.assessed && p.current < 50)
    .map((p) => p.summary);

  return {
    applicationId,
    overallMatchPercent,
    goalMatchPercent,
    entryRequirementMatch: subScore(
      'Entry Requirement Match',
      pillars,
      SUB_SCORE_PILLARS.entryRequirement,
    ),
    experienceMatch: subScore('Experience Match', pillars, SUB_SCORE_PILLARS.experience),
    personalQualitiesMatch: subScore(
      'Personal Qualities Match',
      pillars,
      SUB_SCORE_PILLARS.personalQualities,
    ),
    missingAreas,
    admissionsRisk,
    admissionsConfidence: confidence,
    inputsPresent,
  };
}
