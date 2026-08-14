import type { CandidateContext } from '@/features/apply/domain';
import type {
  CmcaitfFields,
  CompetencyClaim,
  EvidenceItemInput,
  EvidenceSourceKind,
  NarrativeActivity,
  ProfileEvaluationInput,
  ReflectionRecord,
  VaguenessField,
} from '@/shared/evaluation';
import { extractCmcaitfFields, type CmcaitfExtractionInput } from './evaluation/cmcaitf-extraction';
import {
  extractCompetencyClaims,
  type CompetencyExtractionSource,
} from './evaluation/competency-extraction';
import { extractRoleAndTheme, type RoleThemeExtractionInput } from './evaluation/narrative-activity-extraction';

/**
 * Bump when the semantic extraction/grounding contract changes independently
 * of deterministic framework formulae. The API stores this in the existing
 * prompt_version column so a prompt/grounding improvement invalidates a
 * cached report even when ENGINE_VERSION did not change.
 */
export const PERSONAL_REPORT_EXTRACTION_VERSION = 'personal-report-extraction-v2-grounded';

type FreeTextRecord = { id: string; title: string; freeText: string; row: Record<string, unknown> };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GROUNDING_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'for', 'from', 'had', 'has', 'have',
  'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was', 'were',
  'with', 'và', 'của', 'tôi', 'mình', 'là', 'vì', 'cho', 'để', 'trong', 'đã', 'một', 'những', 'các',
]);

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !GROUNDING_STOP_WORDS.has(token));
}

function numbers(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/**
 * Independent post-model grounding check for factual extracted prose.
 *
 * Extraction may paraphrase, so exact substring matching alone is too strict.
 * Every number the extractor introduces MUST occur in the source, and a
 * meaningful share of content words must be traceable to it. Unsupported
 * factual output becomes missing data before F1/F2/F3 ever score it.
 *
 * Role and domain-theme labels are deliberately not passed through this
 * lexical gate: they are semantic classifications (e.g. "founder",
 * "education access"), stored downstream as inferences linked to the source
 * record rather than represented as quoted observations.
 */
export function isGroundedInSource(candidate: string | null | undefined, source: string, threshold = 0.55): boolean {
  if (!candidate?.trim() || !source.trim()) return false;
  const candidateNormalized = normalize(candidate);
  const sourceNormalized = normalize(source);
  if (sourceNormalized.includes(candidateNormalized)) return true;

  const sourceNumbers = new Set(numbers(source));
  if (numbers(candidate).some((value) => !sourceNumbers.has(value))) return false;

  const candidateTokens = meaningfulTokens(candidate);
  if (candidateTokens.length === 0) return false;
  const sourceTokens = new Set(meaningfulTokens(source));
  const matched = candidateTokens.filter((token) => sourceTokens.has(token)).length;
  const required = candidateTokens.length <= 3 ? 1 : Math.ceil(candidateTokens.length * threshold);
  return matched >= required;
}

function achievementRecords(context: CandidateContext): FreeTextRecord[] {
  return context.achievements.map((row) => ({
    id: `achievement:${row.id}`,
    title: text(row.title) || 'Thành tích chưa đặt tên',
    freeText: text(row.detail),
    row,
  }));
}

function activityRecords(context: CandidateContext): FreeTextRecord[] {
  return context.activities.map((row) => ({
    id: `activity:${row.id}`,
    title: text(row.title) || 'Hoạt động chưa đặt tên',
    freeText: text(row.description),
    row,
  }));
}

function writtenFieldsFor(context: CandidateContext): VaguenessField[] {
  const profile = context.profile as Record<string, unknown>;
  return [
    { field: 'careerGoal', label: 'Mục tiêu nghề nghiệp sau khi tốt nghiệp', value: text(profile.goals) || null },
    {
      field: 'studyMotivation',
      label: 'Vì sao bạn quan tâm đến các môn học này',
      value: text(profile.study_motivation) || null,
    },
  ];
}

function profileMotivationsFor(context: CandidateContext): NonNullable<ProfileEvaluationInput['profileMotivations']> {
  const profile = context.profile as Record<string, unknown>;
  const result: Array<{ id: string; label: string; value: string }> = [];
  const general = text(profile.study_motivation);
  if (general) {
    result.push({ id: 'profile:study_motivation', label: 'Study motivation', value: general });
  }

  const subjectMotivations = profile.subject_motivations;
  if (subjectMotivations && typeof subjectMotivations === 'object' && !Array.isArray(subjectMotivations)) {
    for (const [subject, raw] of Object.entries(subjectMotivations as Record<string, unknown>)) {
      const value = text(raw);
      if (!value || result.some((item) => normalize(item.value) === normalize(value))) continue;
      result.push({
        id: `profile:subject_motivations:${subject}`,
        label: `Subject motivation: ${subject}`,
        value,
      });
    }
  }
  return result;
}

function evidenceSourceKindFor(record: FreeTextRecord, kind: 'achievement' | 'activity'): EvidenceSourceKind {
  if (kind === 'achievement' && text(record.row.evidence_key)) return 'uploaded_document';
  return 'structured_achievement';
}

function outcomesFromImpact(impact: string | null): { quantifiedOutcome: string | null; qualitativeOutcome: string | null } {
  if (!impact) return { quantifiedOutcome: null, qualitativeOutcome: null };
  return /\d/.test(impact)
    ? { quantifiedOutcome: impact, qualitativeOutcome: null }
    : { quantifiedOutcome: null, qualitativeOutcome: impact };
}

function groundCmcaitf(record: ReflectionRecord, source: string): ReflectionRecord {
  const grounded = Object.fromEntries(
    Object.entries(record.cmcaitf).map(([key, value]) => [
      key,
      isGroundedInSource(value, source) ? value : null,
    ]),
  ) as CmcaitfFields;
  return { ...record, cmcaitf: grounded };
}

function groundCompetencies(
  claims: readonly CompetencyClaim[],
  sourcesById: ReadonlyMap<string, FreeTextRecord>,
): CompetencyClaim[] {
  return claims.map((claim) => {
    if (!claim.situation?.trim()) return { ...claim, evidenceRefs: [] };
    const groundedRefs = claim.evidenceRefs.filter((ref) => {
      const source = sourcesById.get(ref.id);
      return source ? isGroundedInSource(claim.situation, source.freeText, 0.6) : false;
    });
    if (groundedRefs.length === 0) {
      return { ...claim, situation: null, evidenceRefs: [] };
    }
    return { ...claim, evidenceRefs: groundedRefs };
  });
}

export async function buildProfileEvaluationInput(args: {
  context: CandidateContext;
  subjectId: string;
  generatedAt: string;
  apiKey: string;
  model?: string;
}): Promise<ProfileEvaluationInput> {
  const { context, subjectId, generatedAt, apiKey, model } = args;

  const achievements = achievementRecords(context);
  const activities = activityRecords(context);
  const all = [...achievements, ...activities];
  const sourceById = new Map(all.map((record) => [record.id, record]));

  const cmcaitfInputs: CmcaitfExtractionInput[] = all.map((record) => ({
    id: record.id,
    title: record.title,
    freeText: record.freeText,
  }));
  const competencySources: CompetencyExtractionSource[] = all.map((record) => ({
    id: record.id,
    kind: record.id.startsWith('achievement:') ? 'achievement' : 'activity',
    text: record.freeText,
  }));
  const roleThemeInputs: RoleThemeExtractionInput[] = all.map((record) => ({
    id: record.id,
    title: record.title,
    freeText: record.freeText,
  }));

  const [rawReflectionRecords, rawCompetencyClaims, roleThemeResults] = await Promise.all([
    extractCmcaitfFields({ inputs: cmcaitfInputs, apiKey, model }),
    extractCompetencyClaims({ sources: competencySources, apiKey, model }),
    extractRoleAndTheme({ inputs: roleThemeInputs, apiKey, model }),
  ]);

  const reflectionRecords = rawReflectionRecords.map((record) =>
    groundCmcaitf(record, sourceById.get(record.id)?.freeText ?? ''),
  );
  const competencyClaims = groundCompetencies(rawCompetencyClaims, sourceById);
  const cmcaitfById = new Map(reflectionRecords.map((record) => [record.id, record.cmcaitf]));
  const roleThemeById = new Map(roleThemeResults.map((result) => [result.id, result]));

  const narrativeActivities: NarrativeActivity[] = all.map((record) => {
    const cmcaitf = cmcaitfById.get(record.id);
    const roleTheme = roleThemeById.get(record.id);
    const evidenceKind = record.id.startsWith('achievement:') ? 'achievement' : 'activity';

    return {
      id: record.id,
      title: record.title,
      role: roleTheme?.role ?? null,
      behaviour: cmcaitf?.action ?? null,
      domainTheme: roleTheme?.domainTheme ?? null,
      statedMotivation: cmcaitf?.motivation ?? null,
      outcome: cmcaitf?.impact ?? cmcaitf?.transformation ?? null,
      evidenceRefs: [{ id: record.id, kind: evidenceKind, label: record.title }],
    };
  });

  const evidenceItems: EvidenceItemInput[] = all.map((record) => {
    const kind = record.id.startsWith('achievement:') ? 'achievement' : 'activity';
    const cmcaitf = cmcaitfById.get(record.id);
    const { quantifiedOutcome, qualitativeOutcome } = outcomesFromImpact(cmcaitf?.impact ?? null);

    return {
      id: record.id,
      title: record.title,
      sourceKind: evidenceSourceKindFor(record, kind),
      quantifiedOutcome,
      qualitativeOutcome,
      hasDocument: kind === 'achievement' && Boolean(text(record.row.evidence_key)),
      attributingOrganisation: text(record.row.organisation) || text(record.row.competition) || null,
      level: text(record.row.level) || null,
    };
  });

  const profile = context.profile as Record<string, unknown>;
  const intendedDirection = text(profile.goals) || null;

  return {
    subjectId,
    writtenFields: writtenFieldsFor(context),
    reflectionRecords,
    competencyClaims,
    evidenceItems,
    narrativeActivities,
    profileMotivations: profileMotivationsFor(context),
    intendedDirection,
    generatedAt,
  };
}
