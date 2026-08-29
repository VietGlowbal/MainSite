import { STUDY_MOTIVATION_SUPPLEMENT_KEY, type CandidateContext } from '@/features/apply/domain';
import { analyzeReflectionAnswers } from './reflection-analysis';
import type {
  CmcaitfFields,
  CompetencyClaim,
  EvidenceItemInput,
  EvidenceSourceKind,
  NarrativeActivity,
  ProfileEvaluationInput,
  ReflectionFinding,
  ReflectionRecord,
  VaguenessField,
} from '@/shared/evaluation';
import { extractCmcaitfFields, type CmcaitfExtractionInput } from './evaluation/cmcaitf-extraction';
import {
  extractCompetencyClaims,
  type CompetencyExtractionSource,
} from './evaluation/competency-extraction';
import {
  extractRoleAndTheme,
  type RoleThemeExtractionInput,
  type RoleThemeExtractionResult,
} from './evaluation/narrative-activity-extraction';
import { extractReflectionFindings } from './evaluation/reflection-signal-extraction';

/**
 * Bump when the semantic extraction/grounding contract changes independently
 * of deterministic framework formulae. The API stores this in the existing
 * prompt_version column so a prompt/grounding improvement invalidates a
 * cached report even when ENGINE_VERSION did not change.
 */
export const PERSONAL_REPORT_EXTRACTION_VERSION = 'personal-report-extraction-v12-grounded-activity-evidence';

/** Dynamic report-only evidence rows use this namespace in the supplements table. */
export const PERSONAL_REPORT_EVIDENCE_SUPPLEMENT_PREFIX = 'evidence:';

type FreeTextRecord = {
  id: string;
  title: string;
  freeText: string;
  row: Record<string, unknown>;
};

type InlineEvidenceSupplement = { answer: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function textList(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  return text(value);
}

function explicitFindingText(finding: ReflectionFinding | undefined): string {
  if (!finding) return '';
  const values = Object.entries(finding)
    .filter(([key]) => key !== 'key' && key !== 'summary')
    .flatMap(([, value]) => {
      if (typeof value === 'string') return [value];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
      if (value && typeof value === 'object') return Object.values(value).flatMap((item) => {
        if (typeof item === 'string') return [item];
        return Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === 'string') : [];
      });
      return [];
    });
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join('; ');
}

function normalizedFindingText(signal: { summary?: string; finding?: ReflectionFinding }): string {
  return signal.summary?.trim() || explicitFindingText(signal.finding);
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
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'with',
  'và',
  'của',
  'tôi',
  'mình',
  'là',
  'vì',
  'cho',
  'để',
  'trong',
  'đã',
  'một',
  'những',
  'các',
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
export function isGroundedInSource(
  candidate: string | null | undefined,
  source: string,
  threshold = 0.55,
): boolean {
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
  const required =
    candidateTokens.length <= 3 ? 1 : Math.ceil(candidateTokens.length * threshold);
  return matched >= required;
}

const ROLE_THEME_FACTUAL_FIELDS = ['trigger', 'problem', 'ownership', 'method'] as const;

export function groundRoleThemeEvidence(
  results: readonly RoleThemeExtractionResult[],
  sourcesById: ReadonlyMap<string, { freeText: string }>,
): RoleThemeExtractionResult[] {
  return results.map((result) => {
    const source = sourcesById.get(result.id)?.freeText ?? '';
    const grounded = { ...result };
    for (const field of ROLE_THEME_FACTUAL_FIELDS) {
      grounded[field] = isGroundedInSource(result[field], source, 0.8) ? result[field] : null;
    }
    return grounded;
  });
}

/**
 * Folds an item's structured Context/Motivation/Challenge/Action/Impact/
 * Transformation/Future reflection (and, if confirmed, its AI Reflection
 * Card) into the free text the CMCAITF/competency/role extraction pipeline
 * below already runs over.
 *
 * ─── WHY ENRICH THE FREE TEXT RATHER THAN BYPASS EXTRACTION ─────────────────
 *
 * This pipeline's whole job is CMCAITF — extracting exactly these seven
 * dimensions from a single free-text field, with a grounding check
 * (`isGroundedInSource`) against that same text. A student who has answered
 * the seven reflection questions directly has already done that extraction
 * far more reliably than the model can from a one-paragraph `detail`/
 * `description` — so their answers are prepended, labelled, ahead of the
 * original text rather than replacing the extraction step. The result is a
 * richer, still-groundable source: the extractor finds the CMCAITF fields
 * verbatim (or close to it) instead of inferring them, and every downstream
 * grounding check still passes because the source text now actually
 * contains what it is checking against. The confirmed Reflection Card's
 * `story`/`keyTakeaway`/`futureConnection` are appended too, since a
 * confirmed card is the student's own approved synthesis of the same
 * material.
 */
function enrichedFreeText(row: Record<string, unknown>, baseText: string): string {
  const reflection = row['reflection'] as Record<string, unknown> | null | undefined;
  const card = (row['reflection_card'] ?? row['reflectionCard']) as Record<string, unknown> | null | undefined;

  const reflectionLines = reflection
    ? (['context', 'motivation', 'challenge', 'action', 'impact', 'transformation', 'future'] as const)
        .map((dimension) => {
          const value = text(reflection[dimension]);
          return value
            ? `${dimension[0]?.toUpperCase()}${dimension.slice(1)}: ${value}`
            : null;
        })
        .filter((line): line is string => line !== null)
    : [];

  const cardLines = [
    card ? text(card['story']) : '',
    card ? text(card['keyTakeaway']) : '',
    card ? text(card['futureConnection']) : '',
  ].filter((line) => line.length > 0);

  return [...reflectionLines, ...cardLines, baseText]
    .filter((part) => part.length > 0)
    .join('\n');
}

function achievementRecords(context: CandidateContext): FreeTextRecord[] {
  return context.achievements.map((row) => ({
    id: `achievement:${row.id}`,
    title: text(row.title) || 'Untitled achievement',
    freeText: enrichedFreeText(row, text(row.detail)),
    row,
  }));
}

function activityRecords(context: CandidateContext): FreeTextRecord[] {
  return context.activities.map((row) => ({
    id: `activity:${row.id}`,
    title: text(row.title) || 'Untitled activity',
    freeText: enrichedFreeText(row, text(row.description)),
    row,
  }));
}

function inlineEvidenceTitle(answer: string): string {
  const firstLine = answer
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  const compact = (firstLine || answer).replace(/\s+/g, ' ').trim();
  if (compact.length <= 88) return compact;
  return `${compact.slice(0, 85).trimEnd()}…`;
}

function inlineEvidenceActivities(
  supplements: Record<string, string>,
): CandidateContext['activities'] {
  return Object.entries(supplements)
    .filter(([fieldKey]) => fieldKey.startsWith(PERSONAL_REPORT_EVIDENCE_SUPPLEMENT_PREFIX))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([fieldKey, raw]) => {
      let payload: InlineEvidenceSupplement | null = null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && typeof (parsed as { answer?: unknown }).answer === 'string') {
          payload = { answer: (parsed as { answer: string }).answer.trim() };
        }
      } catch {
        return [];
      }

      if (!payload?.answer) return [];
      const id = fieldKey.slice(PERSONAL_REPORT_EVIDENCE_SUPPLEMENT_PREFIX.length);
      return [
        {
          id: `personal-report-evidence:${id}`,
          title: inlineEvidenceTitle(payload.answer),
          description: payload.answer,
          source_type: 'personal_report_supplement',
        },
      ];
    });
}

/**
 * Overlays report-only supplementary answers (`personal_report_supplements`
 * — see `supabase-personal-report-supplements.sql`) onto a COPY of the
 * candidate context, purely for this generation call. It never mutates or
 * writes back to the student's confirmed Candidate Information.
 *
 * Motivation supplements replace the effective report-only motivation.
 * Quick evidence captured from the Personal Canvas is appended as a
 * self-reported activity source. It deliberately carries no document or
 * verification flag, so F3 continues to treat it as self-reported evidence.
 */
export function applyPersonalReportSupplements(
  context: CandidateContext,
  supplements: Record<string, string>,
): CandidateContext {
  const motivation = supplements[STUDY_MOTIVATION_SUPPLEMENT_KEY];
  const supplementalActivities = inlineEvidenceActivities(supplements);
  if (!motivation && supplementalActivities.length === 0) return context;

  return {
    ...context,
    profile: motivation
      ? { ...context.profile, study_motivation: motivation }
      : context.profile,
    activities:
      supplementalActivities.length > 0
        ? [...context.activities, ...supplementalActivities]
        : context.activities,
  };
}

function writtenFieldsFor(context: CandidateContext): VaguenessField[] {
  const profile = context.profile as Record<string, unknown>;
  return [
    {
      field: 'careerGoal',
      label: 'Career goal after graduation',
      value: text(profile.goals ?? profile.careerGoal) || null,
    },
    {
      field: 'studyMotivation',
      label: 'Why you are interested in these subjects',
      value: text(profile.study_motivation ?? profile.studyMotivation) || null,
    },
  ];
}

function profileMotivationsFor(
  context: CandidateContext,
): NonNullable<ProfileEvaluationInput['profileMotivations']> {
  const profile = context.profile as Record<string, unknown>;
  const result: Array<{ id: string; label: string; value: string }> = [];
  const general = text(profile.study_motivation ?? profile.studyMotivation);
  if (general) {
    result.push({ id: 'profile:study_motivation', label: 'Study motivation', value: general });
  }

  const subjectMotivations = profile.subject_motivations ?? profile.subjectMotivations;
  if (
    subjectMotivations &&
    typeof subjectMotivations === 'object' &&
    !Array.isArray(subjectMotivations)
  ) {
    for (const [subject, raw] of Object.entries(
      subjectMotivations as Record<string, unknown>,
    )) {
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

function evidenceSourceKindFor(
  record: FreeTextRecord,
  kind: 'achievement' | 'activity',
): EvidenceSourceKind {
  if (kind === 'achievement' && text(record.row.evidence_key)) return 'uploaded_document';
  return 'structured_achievement';
}

function outcomesFromImpact(impact: string | null): {
  quantifiedOutcome: string | null;
  qualitativeOutcome: string | null;
} {
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
  const profile = context.profile as Record<string, unknown>;
  const reflectionAnswers = (profile.personal_reflection_answers ?? profile.personalReflection ?? null) as
    | Record<string, string | undefined>
    | null;
  const reflectionAnalysis = analyzeReflectionAnswers(
    reflectionAnswers,
    all.map((record) => record.freeText),
  );
  const q4Signal = reflectionAnalysis.signals.find((signal) => signal.key === 'q4');
  const capabilityReflectionRecord: FreeTextRecord | null = q4Signal
    ? {
        id: `profile:reflection_${q4Signal.key}`,
        title: 'Personal reflection — capability ownership',
        freeText: q4Signal.value,
        row: { source_type: 'profile_reflection', review_status: 'reviewed' },
      }
    : null;
  const sourceById = new Map(
    [...all, ...(capabilityReflectionRecord ? [capabilityReflectionRecord] : [])].map((record) => [
      record.id,
      record,
    ]),
  );

  const cmcaitfInputs: CmcaitfExtractionInput[] = all.map((record) => ({
    id: record.id,
    title: record.title,
    freeText: record.freeText,
  }));
  const competencySources: CompetencyExtractionSource[] = [
    ...all.map((record) => ({
      id: record.id,
      kind: record.id.startsWith('achievement:') ? 'achievement' : 'activity',
      text: record.freeText,
    })),
    ...(capabilityReflectionRecord
      ? [{
          id: capabilityReflectionRecord.id,
          kind: 'profile_reflection',
          text: capabilityReflectionRecord.freeText,
        }]
      : []),
  ];
  const roleThemeInputs: RoleThemeExtractionInput[] = all.map((record) => ({
    id: record.id,
    title: record.title,
    freeText: record.freeText,
  }));

  const [rawReflectionRecords, rawCompetencyClaims, rawRoleThemeResults, reflectionFindings] = await Promise.all([
    extractCmcaitfFields({ inputs: cmcaitfInputs, apiKey, model }),
    extractCompetencyClaims({ sources: competencySources, apiKey, model }),
    extractRoleAndTheme({ inputs: roleThemeInputs, apiKey, model }),
    extractReflectionFindings({
      signals: reflectionAnalysis.signals,
      apiKey,
      ...(model ? { model } : {}),
    }),
  ]);
  const reflectionSignals = reflectionAnalysis.signals.map((signal) => {
    const finding = reflectionFindings.get(signal.key);
    return finding
      ? {
          ...signal,
          finding,
          ...(finding.summary ? { summary: finding.summary } : {}),
        }
      : signal;
  });

  const reflectionRecords = rawReflectionRecords.map((record) =>
    groundCmcaitf(record, sourceById.get(record.id)?.freeText ?? ''),
  );
  const competencyClaims = groundCompetencies(rawCompetencyClaims, sourceById);
  const roleThemeResults = groundRoleThemeEvidence(rawRoleThemeResults, sourceById);
  const cmcaitfById = new Map(
    reflectionRecords.map((record) => [record.id, record.cmcaitf]),
  );
  const roleThemeById = new Map(roleThemeResults.map((result) => [result.id, result]));

  const narrativeActivities: NarrativeActivity[] = all.map((record) => {
    const cmcaitf = cmcaitfById.get(record.id);
    const roleTheme = roleThemeById.get(record.id);
    const evidenceKind = record.id.startsWith('achievement:') ? 'achievement' : 'activity';

    return {
      id: record.id,
      title: record.title,
      organisation: text(record.row.organisation ?? record.row.organization) || null,
      level: text(record.row.level) || null,
      year: typeof record.row.year === 'number' ? record.row.year : null,
      period: text(record.row.period) || null,
      competition: text(record.row.competition) || null,
      evidenceKey: text(record.row.evidence_key ?? record.row.evidenceKey) || null,
      reviewStatus: text(record.row.review_status ?? record.row.reviewStatus) || null,
      sourceType: text(record.row.source_type ?? record.row.sourceType) || null,
      sources: Array.isArray(record.row.sources) ? record.row.sources : [],
      reflection:
        record.row.reflection && typeof record.row.reflection === 'object'
          ? (record.row.reflection as Record<string, unknown>)
          : null,
      reflectionCard:
        (record.row.reflection_card ?? record.row.reflectionCard) &&
        typeof (record.row.reflection_card ?? record.row.reflectionCard) === 'object'
          ? ((record.row.reflection_card ?? record.row.reflectionCard) as Record<string, unknown>)
          : null,
      role: roleTheme?.role ?? null,
      behaviour: cmcaitf?.action ?? null,
      domainTheme: roleTheme?.domainTheme ?? null,
      statedMotivation: cmcaitf?.motivation ?? null,
      outcome: cmcaitf?.impact ?? cmcaitf?.transformation ?? null,
      narrativeEvidence: {
        context: cmcaitf?.context ?? null,
        trigger: roleTheme?.trigger ?? null,
        problem: roleTheme?.problem ?? null,
        motivation: cmcaitf?.motivation ?? null,
        challenge: cmcaitf?.challenge ?? null,
        action: cmcaitf?.action ?? null,
        ownership: roleTheme?.ownership ?? null,
        method: roleTheme?.method ?? null,
        impact: cmcaitf?.impact ?? null,
        transformation: cmcaitf?.transformation ?? null,
        future: cmcaitf?.future ?? null,
        role: roleTheme?.role ?? null,
        domainTheme: roleTheme?.domainTheme ?? null,
        candidateCapabilitySignals: competencyClaims
          .filter((claim) => claim.evidenceRefs.some((ref) => ref.id === record.id))
          .map((claim) => claim.label),
      },
      evidenceRefs: [{ id: record.id, kind: evidenceKind, label: record.title }],
    };
  });

  const evidenceItems: EvidenceItemInput[] = all.map((record) => {
    const kind = record.id.startsWith('achievement:') ? 'achievement' : 'activity';
    const cmcaitf = cmcaitfById.get(record.id);
    const { quantifiedOutcome, qualitativeOutcome } = outcomesFromImpact(
      cmcaitf?.impact ?? null,
    );

    return {
      id: record.id,
      title: record.title,
      organisation: text(record.row.organisation ?? record.row.organization) || null,
      competition: text(record.row.competition) || null,
      year: typeof record.row.year === 'number' ? record.row.year : null,
      period: text(record.row.period) || null,
      evidenceKey: text(record.row.evidence_key ?? record.row.evidenceKey) || null,
      reviewStatus: text(record.row.review_status ?? record.row.reviewStatus) || null,
      sourceType: text(record.row.source_type ?? record.row.sourceType) || null,
      sources: Array.isArray(record.row.sources) ? record.row.sources : [],
      sourceKind: evidenceSourceKindFor(record, kind),
      quantifiedOutcome,
      qualitativeOutcome,
      hasDocument: kind === 'achievement' && Boolean(text(record.row.evidence_key ?? record.row.evidenceKey)),
      attributingOrganisation:
        text(record.row.organisation ?? record.row.organization) || text(record.row.competition) || null,
      level: text(record.row.level) || null,
    };
  });

  // The seven Personal Reflection answers are routed by dimension. Activity
  // and achievement text is the independent corroborating source for status.
  const reflectionWrittenFields: VaguenessField[] = reflectionSignals.map((signal) => ({
    field: `reflection_${signal.key}`,
    label: `Personal reflection — ${signal.dimension.replaceAll('_', ' ')}`,
    value: signal.value,
  }));
  const reflectionMotivations = reflectionSignals
    .filter((signal) => signal.key === 'q1' || signal.key === 'q2' || signal.key === 'q3')
    .map((signal) => ({ signal, value: normalizedFindingText(signal) }))
    .filter(({ value }) => Boolean(value))
    .map((signal) => ({
      id: `profile:reflection_${signal.signal.key}`,
      label: `Reflection — ${signal.signal.dimension.replaceAll('_', ' ')}`,
      value: signal.value,
    }));

  const reflectionDirection = reflectionSignals
    .filter((signal) => signal.key === 'q5' || signal.key === 'q6' || signal.key === 'q7')
    .map((signal) => normalizedFindingText(signal))
    .filter(Boolean)
    .join('; ');
  const rawSubjects = profile.target_subjects ?? profile.majors;
  const subjectDirection = Array.isArray(rawSubjects)
    ? rawSubjects.map(text).filter(Boolean).join(', ')
    : text(rawSubjects);
  const careerDirection = textList(profile.career_interests ?? profile.careerInterests);
  const intendedDirection = [text(profile.goals ?? profile.careerGoal), subjectDirection, careerDirection, reflectionDirection]
    .filter(Boolean)
    .join('; ') || null;
  const directionSignals = {
      academicDirection:
      normalizedFindingText(reflectionSignals.find((signal) => signal.key === 'q5') ?? {}) || subjectDirection || null,
    careerDirection:
      normalizedFindingText(reflectionSignals.find((signal) => signal.key === 'q6') ?? {}) || careerDirection || null,
    preferredEnvironment:
      normalizedFindingText(reflectionSignals.find((signal) => signal.key === 'q7') ?? {}) || null,
  };

  return {
    subjectId,
    writtenFields: [...writtenFieldsFor(context), ...reflectionWrittenFields],
    reflectionRecords,
    competencyClaims,
    evidenceItems,
    narrativeActivities,
    profileMotivations: [...profileMotivationsFor(context), ...reflectionMotivations],
    reflectionAnswerSignals: reflectionSignals,
    capabilitySignals: q4Signal
      ? [
          q4Signal,
        ]
      : [],
    directionSignals,
    intendedDirection,
    generatedAt,
  };
}
