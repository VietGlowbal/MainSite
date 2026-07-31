import { z } from 'zod';

export const REPORT_PROMPT_VERSION = 'personal-report-v1-vi';
export const MATCH_PROMPT_VERSION_V2 = 'match-insights-v2-vi';

export const reportStatusSchema = z.enum(['established', 'emerging', 'limited']);
export const reportConfidenceSchema = z.enum(['high', 'medium', 'low']);

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

export const narrativeSectionSchema = z.object({
  status: reportStatusSchema,
  headline: z.string().min(1).max(180),
  narrative: z.string().min(1).max(1600),
  confidence: reportConfidenceSchema,
  evidenceRefs: z.array(evidenceRefSchema).max(8),
  limitation: z.string().max(500).optional(),
});

export const emergingThemeSchema = narrativeSectionSchema.extend({
  theme: z.string().min(1).max(100),
});

export const proofItemSchema = z.object({
  status: reportStatusSchema,
  title: z.string().min(1).max(160),
  role: z.string().max(160).optional(),
  contribution: z.string().min(1).max(700),
  outcome: z.string().max(500).optional(),
  competencies: z.array(z.string().min(1).max(100)).max(6),
  evidenceStrength: z.enum(['strong', 'moderate', 'limited']),
  evidenceRefs: z.array(evidenceRefSchema).min(1).max(4),
});

export const personalReportSchema = z.object({
  summary: z.string().min(1).max(1600),
  confidence: z.number().int().min(0).max(100),
  confidenceLevel: reportConfidenceSchema,
  limitations: z.array(z.string().min(1).max(500)).max(10),
  coreIdentity: narrativeSectionSchema,
  drivingForce: narrativeSectionSchema,
  signaturePattern: narrativeSectionSchema,
  emergingThemes: z.array(emergingThemeSchema).max(5),
  personalPositioning: narrativeSectionSchema,
  proofOfMe: z.array(proofItemSchema).max(8),
});

const draftEvidenceIdsSchema = z.array(z.string().min(1).max(160)).max(8);

const draftNarrativeSectionSchema = z.object({
  status: reportStatusSchema,
  headline: z.string().min(1).max(180),
  narrative: z.string().min(1).max(1600),
  evidenceIds: draftEvidenceIdsSchema,
  limitation: z.string().max(500).optional(),
});

const draftThemeSchema = draftNarrativeSectionSchema.extend({
  theme: z.string().min(1).max(100),
});

const draftProofSchema = z.object({
  status: reportStatusSchema,
  title: z.string().min(1).max(160),
  role: z.string().max(160).optional(),
  contribution: z.string().min(1).max(700),
  outcome: z.string().max(500).optional(),
  competencies: z.array(z.string().min(1).max(100)).max(6),
  evidenceStrength: z.enum(['strong', 'moderate', 'limited']),
  evidenceIds: z.array(z.string().min(1).max(160)).min(1).max(4),
});

/** Strict provider output. Evidence labels and confidence are server-owned. */
export const personalReportDraftSchema = z.object({
  summary: z.string().min(1).max(1600),
  limitations: z.array(z.string().min(1).max(500)).max(10),
  coreIdentity: draftNarrativeSectionSchema,
  drivingForce: draftNarrativeSectionSchema,
  signaturePattern: draftNarrativeSectionSchema,
  emergingThemes: z.array(draftThemeSchema).max(5),
  personalPositioning: draftNarrativeSectionSchema,
  proofOfMe: z.array(draftProofSchema).max(8),
});

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type PersonalReport = z.infer<typeof personalReportSchema>;
export type PersonalReportDraft = z.infer<typeof personalReportDraftSchema>;

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

export function candidateConfidence(context: CandidateContext): {
  score: number;
  level: z.infer<typeof reportConfidenceSchema>;
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

function confidenceForEvidence(
  ids: string[],
  evidenceById: Map<string, EvidenceRef>,
  overall: z.infer<typeof reportConfidenceSchema>,
): z.infer<typeof reportConfidenceSchema> {
  const valid = ids.map((id) => evidenceById.get(id)).filter(Boolean);
  if (valid.length < 2) return 'low';
  const hasDocument = valid.some(
    (ref) => ref?.kind === 'document' || ref?.kind === 'english_test' || ref?.kind === 'standardized_test',
  );
  if (overall === 'high' && hasDocument) return 'high';
  return 'medium';
}

export function hydratePersonalReport(
  draft: PersonalReportDraft,
  context: CandidateContext,
): PersonalReport {
  const evidenceById = new Map(context.evidence.map((item) => [item.id, item]));
  const confidence = candidateConfidence(context);
  const hydrateIds = (ids: string[], min = 0): EvidenceRef[] => {
    const uniqueIds = [...new Set(ids)];
    const refs = uniqueIds.flatMap((id) => {
      const ref = evidenceById.get(id);
      return ref ? [ref] : [];
    });
    if (refs.length !== uniqueIds.length) {
      throw new Error('REPORT_EVIDENCE_INVALID');
    }
    if (refs.length < min) {
      throw new Error('REPORT_EVIDENCE_INVALID');
    }
    return refs;
  };
  const narrative = (section: PersonalReportDraft['coreIdentity']) => {
    const refs = hydrateIds(section.evidenceIds);
    const forcedLimited = refs.length < 2 || context.achievements.length + context.activities.length < 3;
    return {
      status: forcedLimited ? ('limited' as const) : section.status,
      headline: section.headline,
      narrative: section.narrative,
      confidence: confidenceForEvidence(section.evidenceIds, evidenceById, confidence.level),
      evidenceRefs: refs,
      ...(section.limitation ? { limitation: section.limitation } : {}),
    };
  };

  return personalReportSchema.parse({
    summary: draft.summary,
    confidence: confidence.score,
    confidenceLevel: confidence.level,
    limitations: [...new Set([...confidence.limitations, ...draft.limitations])].slice(0, 10),
    coreIdentity: narrative(draft.coreIdentity),
    drivingForce: narrative(draft.drivingForce),
    signaturePattern: narrative(draft.signaturePattern),
    emergingThemes: draft.emergingThemes.map((theme) => ({
      ...narrative(theme),
      theme: theme.theme,
    })),
    personalPositioning: narrative(draft.personalPositioning),
    proofOfMe: draft.proofOfMe.map((proof) => ({
      status: proof.status,
      title: proof.title,
      ...(proof.role ? { role: proof.role } : {}),
      contribution: proof.contribution,
      ...(proof.outcome ? { outcome: proof.outcome } : {}),
      competencies: proof.competencies,
      evidenceStrength: proof.evidenceStrength,
      evidenceRefs: hydrateIds(proof.evidenceIds, 1),
    })),
  });
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
    score: z.number().int().min(1).max(5).nullable(),
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
  const academicScore = fit.dimensions.academicCompetitiveness.score;
  const classification = academicScore >= 5 ? 'safety' : academicScore >= 3 ? 'match' : 'reach';
  return { ...fit, classification };
}
