import type { CandidateContext } from '@/features/apply/domain';
import type {
  EvidenceItemInput,
  EvidenceSourceKind,
  NarrativeActivity,
  ProfileEvaluationInput,
  VaguenessField,
} from '@/shared/evaluation';
import { extractCmcaitfFields, type CmcaitfExtractionInput } from './evaluation/cmcaitf-extraction';
import {
  extractCompetencyClaims,
  type CompetencyExtractionSource,
} from './evaluation/competency-extraction';
import { extractRoleAndTheme, type RoleThemeExtractionInput } from './evaluation/narrative-activity-extraction';

/**
 * Orchestration for the canonical Personal Report's `ProfileEvaluationInput`.
 *
 * The Shared Evaluation Engine (`src/shared/evaluation`) is pure and needs
 * `ReflectionRecord[]`, `CompetencyClaim[]`, `EvidenceItemInput[]` and
 * `NarrativeActivity[]` already built. This module is the one place that
 * runs the THREE genuinely semantic extraction steps
 * (`src/lib/ai/evaluation/*`) against the SAME free text — an achievement's
 * `detail` or an activity's `description` — and assembles their outputs into
 * the engine's input shape. Nothing here scores anything; every scoring
 * decision stays inside `src/shared/evaluation`.
 *
 * ─── ONE ID CONVENTION, SHARED WITH `CandidateContext.evidence` ─────────────
 *
 * `achievement:<id>` / `activity:<id>` is the same convention
 * `candidate-context.ts` already uses for `EvidenceRef.id`. Every
 * `NarrativeActivity`, `EvidenceItemInput` and extraction source below reuses
 * it, which is what lets `buildPersonalReport` (personal-report.ts) match a
 * Proof of Me card's `evidenceRefs` back to the same evidence item the F3
 * evidence hierarchy scored — a mismatch here would silently break every
 * Proof of Me verification-tier lookup.
 *
 * ─── DEGRADES WITHOUT A MODEL, NEVER THROWS ON MISSING KEY ALONE ────────────
 *
 * `buildProfileEvaluationInput` still returns a structurally valid input when
 * no free text exists anywhere (every extraction call already no-ops on empty
 * input — see each extractor's own header) — this only calls the model when
 * there is something worth reading.
 */

type FreeTextRecord = { id: string; title: string; freeText: string; row: Record<string, unknown> };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

/** F6 — the two free-text profile fields F1's narrative sections are built from. */
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

/**
 * F3's `sourceKind` only changes `tierFor`'s verdict when it is itself
 * `uploaded_document`/`test_record` (auto-verified) or `external_attribution`
 * (auto-attributable) — everything else defers to `hasDocument` and
 * `attributingOrganisation`, which are set independently below. So an
 * achievement backed by a stored evidence file is `uploaded_document`;
 * everything else — achievement or activity — is `structured_achievement`,
 * meaning "the student entered this into a structured form field", which is
 * true of both tables and lets `hasDocument`/`attributingOrganisation` do
 * the actual verification work.
 */
function evidenceSourceKindFor(record: FreeTextRecord, kind: 'achievement' | 'activity'): EvidenceSourceKind {
  if (kind === 'achievement' && text(record.row.evidence_key)) return 'uploaded_document';
  return 'structured_achievement';
}

/** F3's two outcome fields, derived from F1's own extracted Impact field rather than re-asked of the model. */
function outcomesFromImpact(impact: string | null): { quantifiedOutcome: string | null; qualitativeOutcome: string | null } {
  if (!impact) return { quantifiedOutcome: null, qualitativeOutcome: null };
  return /\d/.test(impact)
    ? { quantifiedOutcome: impact, qualitativeOutcome: null }
    : { quantifiedOutcome: null, qualitativeOutcome: impact };
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

  const [reflectionRecords, competencyClaims, roleThemeResults] = await Promise.all([
    extractCmcaitfFields({ inputs: cmcaitfInputs, apiKey, model }),
    extractCompetencyClaims({ sources: competencySources, apiKey, model }),
    extractRoleAndTheme({ inputs: roleThemeInputs, apiKey, model }),
  ]);

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
    intendedDirection,
    generatedAt,
  };
}
