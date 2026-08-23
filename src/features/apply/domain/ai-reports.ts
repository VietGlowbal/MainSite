import { z } from 'zod';

/**
 * ⚠️ v1 Personal Report (`personal-report-v1-vi`) IS DEPRECATED.
 *
 * The schemas and hydration logic that used to live here
 * (`personalReportSchema`, `personalReportDraftSchema`, `hydratePersonalReport`,
 * `candidateConfidence`'s report-shaping half) built the OLD six-tab narrative
 * report from a model-authored draft. The canonical Personal Report is now
 * `PersonalReportV2` (`src/features/apply/domain/personal-report.ts`), built
 * deterministically on top of the Shared Evaluation Engine's
 * `ProfileEvaluation` (`src/shared/evaluation`) — see
 * `docs/ai-evaluation-engine.md`. `/ai-strategy/report` permanently redirects
 * to `/ai-strategy/personal-report` (`next.config.ts`).
 *
 * `CandidateContext`/`loadCandidateContext` are NOT deprecated — the v2
 * pipeline (`src/lib/ai/personal-report-v2.ts`) still reads the same
 * candidate context shape, it just extracts a `ProfileEvaluationInput` from
 * it instead of prompting a model for a whole report draft. `evidenceRefSchema`'s
 * shape survives as the plain `EvidenceRef` type below for the same reason.
 */
export const MATCH_PROMPT_VERSION_V2 = 'match-insights-v2-vi';

export const evidenceKindSchema = z.enum([
  'achievement',
  'activity',
  'profile',
  'english_test',
  'standardized_test',
  'document',
]);

export const evidenceRefSchema = z.object({
  id: z.string().min(1).max(160),
  kind: evidenceKindSchema,
  label: z.string().min(1).max(240),
});

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export type CandidateContext = {
  profile: Record<string, unknown>;
  achievements: Array<Record<string, unknown> & { id: string }>;
  activities: Array<Record<string, unknown> & { id: string }>;
  englishTests: Array<Record<string, unknown> & { id: string }>;
  standardizedTests: Array<Record<string, unknown> & { id: string }>;
  documents: Array<Record<string, unknown> & { id: string }>;
  evidence: EvidenceRef[];
};

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

/**
 * A 0-100 confidence score derived from how much of the candidate context is
 * actually filled in — still used by the Matching Report's `match-insights`
 * route to cap its own system-fit confidence. NOT part of v1's report
 * hydration anymore; that half of this function's original job
 * (`hydratePersonalReport`) is deleted, but the score itself is a generic
 * "how complete is this profile" signal with its own caller.
 */
export function candidateConfidence(context: CandidateContext): {
  score: number;
  level: 'high' | 'medium' | 'low';
  limitations: string[];
} {
  const profileValues = Object.values(context.profile).filter(
    (value) =>
      value !== null &&
      value !== '' &&
      (!Array.isArray(value) || value.length > 0) &&
      (typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value as Record<string, unknown>).length > 0),
  );
  const activityCount = context.achievements.length + context.activities.length;
  const corroborated = context.achievements.some(
    (item) => typeof item.evidence_key === 'string' && item.evidence_key.length > 0,
  );
  const testCount = context.englishTests.length + context.standardizedTests.length;

  let score = Math.min(40, profileValues.length * 4);
  score += Math.min(35, activityCount * 7);
  score += Math.min(10, testCount * 5);
  if (corroborated) score += 15;

  const limitations: string[] = [];
  if (activityCount < 3) {
    limitations.push(
      'Chưa có đủ ba hoạt động độc lập để xác lập một mẫu hình ứng viên đáng tin cậy.',
    );
    score = Math.min(score, 54);
  }
  if (!corroborated) {
    limitations.push('Các nhận định hiện chủ yếu dựa trên thông tin tự khai, chưa có bằng chứng đính kèm.');
    score = Math.min(score, 74);
  }
  if (profileValues.length < 5) {
    limitations.push('Hồ sơ học tập và định hướng còn thiếu dữ liệu.');
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalized,
    level: normalized >= 75 ? 'high' : normalized >= 50 ? 'medium' : 'low',
    limitations,
  };
}

export const fitDimensionKeySchema = z.enum([
  'academicCompetitiveness',
  'personaAlignment',
  'financialFeasibility',
  'careerDirection',
  'applicationReadiness',
]);

export const fitDimensionSchema = z
  .object({
    status: z.enum(['assessed', 'limited', 'not_available']),
    /**
     * 1-5. Fractional values are allowed on purpose: the Matching Report
     * renders these as percentages, and five integers can only ever produce
     * multiples of 20. See `fitScoreToPercent` in the shared engine.
     */
    score: z.number().min(1).max(5).nullable(),
    summary: z.string().min(1).max(800),
    strengths: z.array(z.string().min(1).max(300)).max(5),
    gaps: z.array(z.string().min(1).max(300)).max(5),
    evidence: z.array(z.string().min(1).max(500)).max(6),
    limitation: z.string().max(500).optional(),
  })
  .superRefine((dimension, refinement) => {
    if (dimension.status === 'not_available' && dimension.score !== null) {
      refinement.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'A missing dimension must use a null score.',
      });
    }
    if (dimension.status !== 'not_available' && dimension.score === null) {
      refinement.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'An assessed or limited dimension requires a score.',
      });
    }
  });

export const eligibilitySchema = z.object({
  requiredSubjects: z.enum(['met', 'not_met', 'unknown']),
  minimumQualification: z.enum(['met', 'not_met', 'unknown']),
  languageRequirement: z.enum(['met', 'not_met', 'unknown']),
  citizenshipRequirement: z.enum(['met', 'not_met', 'unknown']),
  deadline: z.enum(['met', 'not_met', 'unknown']),
});

export const programmeFitSchema = z.object({
  classification: z.enum([
    'safety',
    'strong_match',
    'match',
    'reach',
    'currently_ineligible',
    'insufficient_data',
  ]),
  confidence: z.number().int().min(0).max(100),
  limitations: z.array(z.string().min(1).max(500)).max(10),
  eligibility: eligibilitySchema,
  dimensions: z.object({
    academicCompetitiveness: fitDimensionSchema,
    personaAlignment: fitDimensionSchema,
    financialFeasibility: fitDimensionSchema,
    careerDirection: fitDimensionSchema,
    applicationReadiness: fitDimensionSchema,
  }),
});

export type ProgrammeFit = z.infer<typeof programmeFitSchema>;

export type MatchingAnalysisView = {
  fit: ProgrammeFit;
  createdAt: string;
  promptVersion: string;
  inputHash: string | null;
  strengths: string[];
  weaknesses: string[];
};

export type MatchingApplicationSummary = {
  id: string;
  universityName: string;
  courseName: string;
  country: string | null;
  degreeLevel: string | null;
  deadline: string | null;
  analysis: MatchingAnalysisView | null;
};

export type MatchingReportPageData = MatchingApplicationSummary & {
  universityId: number | null;
  courseUrl: string | null;
  studyMode: string | null;
  intake: string | null;
  status: string;
  course: {
    summary: string | null;
    duration: string | null;
    tuition: string | null;
    entryRequirements: string | null;
    englishRequirements: string | null;
    sourceConfidence: number | null;
    lastExtractedAt: string | null;
  };
  university: {
    logoUrl: string | null;
    imageUrl: string | null;
    qsRank: number | null;
    theRank: number | null;
    insight: string | null;
    bestFor: string | null;
    teachingStyle: string | null;
    requirements: string[];
    tuition: string | null;
    livingCost: string | null;
    scholarship: string | null;
    careerOutcomes: string[];
  } | null;
  scholarships: Array<{
    id: string;
    name: string;
    coverage: string | null;
    eligibility: string | null;
    deadline: string | null;
    sourceUrl: string | null;
  }>;
};

/**
 * The Reach/Match/Safety band is decided by hard eligibility and the academic
 * dimension ALONE. A model may propose a classification; this function
 * overrules it, so a well-aligned but academically-short applicant can never be
 * told they are a "Match" because their values fit nicely.
 *
 * `strong_match` sits between match and safety: comfortably inside the
 * programme's range without being clearly above it. Thresholds are evenly
 * spaced across the 1-5 rubric and preserve the previous integer behaviour
 * (5 safety, 3 match, 2 and below reach); the one change is that 4 is now
 * `strong_match` where it used to fall into `match`.
 *
 * Mirrors `classify()` in `src/shared/evaluation/f5-programme-fit.ts`, which
 * does the same job for the deterministic engine. The two must not diverge —
 * see the contract test in ai-reports.test.ts.
 */
export function enforceFitClassification(fit: ProgrammeFit): ProgrammeFit {
  const hardFilters = Object.values(fit.eligibility);
  if (hardFilters.includes('not_met')) {
    return { ...fit, classification: 'currently_ineligible' };
  }
  if (
    fit.dimensions.academicCompetitiveness.status !== 'assessed' ||
    fit.dimensions.academicCompetitiveness.score === null
  ) {
    return { ...fit, classification: 'insufficient_data' };
  }
  return { ...fit, classification: academicBandClassification(fit.dimensions.academicCompetitiveness.score) };
}

/** The score-to-band thresholds, exported so the report UI and tests share one source. */
export function academicBandClassification(
  academicScore: number,
): 'safety' | 'strong_match' | 'match' | 'reach' {
  if (academicScore >= 4.5) return 'safety';
  if (academicScore >= 3.5) return 'strong_match';
  if (academicScore >= 2.5) return 'match';
  return 'reach';
}
