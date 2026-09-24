import {
  canonicalSnapshotPayloadString,
} from '@/features/apply/api/candidate-snapshot-repository';
import { createHash } from 'crypto';
import type { AcademicRecord, ApplicantAIState } from './domain';

/**
 * Reconstructs the ApplicantAIState from ONE confirmed snapshot (Task 5).
 *
 * SNAPSHOT-ONLY BY CONSTRUCTION: this module's only database read is
 * `confirmed_candidate_snapshots`, filtered by user_id + application_id (+ id
 * when a specific snapshot is requested). There is no code path that could
 * reach `student_profiles`, `student_achievements`, or any other live table --
 * so editing live data after snapshot A can never change state A, and a test
 * can prove it by throwing on any other table access.
 */

export class SnapshotNotFoundError extends Error {
  constructor() {
    super('No confirmed candidate snapshot matches this application and user.');
    this.name = 'SnapshotNotFoundError';
  }
}

type SnapshotRow = {
  id: string;
  user_id: string;
  application_id: string;
  payload_hash?: string | null;
  supersedes_snapshot_id?: string | null;
  schema_version?: number | null;
  payload: {
    reflection: Record<string, unknown>;
    documents?: Array<{ id?: string; fileName?: string }> | unknown[];
    academicRecords?: unknown;
    followUpAnswers?: Array<{
      activityId: string;
      dimension: string;
      question: string;
      answer: string;
      round: number;
    }>;
  };
};

export async function buildApplicantStateFromSnapshot(args: {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  userId: string;
  applicationId: string;
  /** Omit for the application's latest snapshot; pass to pin an exact one. */
  snapshotId?: string;
}): Promise<ApplicantAIState> {
  const { supabase, userId, applicationId } = args;

  let query = supabase
    .from('confirmed_candidate_snapshots')
    .select(
      'id,user_id,application_id,schema_version,payload_hash,supersedes_snapshot_id,payload,confirmed_at',
    )
    .eq('user_id', userId)
    .eq('application_id', applicationId);
  if (args.snapshotId) query = query.eq('id', args.snapshotId);
  const { data, error } = await query
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[applicant-state] snapshot read failed', error);
    throw new SnapshotNotFoundError();
  }
  if (!data || data.application_id !== applicationId || data.user_id !== userId) {
    throw new SnapshotNotFoundError();
  }

  return stateFromSnapshotRow(data as unknown as SnapshotRow);
}

/** Pure converter -- exported for tests and Task 8 reuse. */
export function stateFromSnapshotRow(row: SnapshotRow): ApplicantAIState {
  const reflection = row.payload?.reflection ?? {};
  const followUps = row.payload?.followUpAnswers ?? [];
  const followUpsByActivity = new Map<string, typeof followUps>();
  for (const answer of followUps) {
    const list = followUpsByActivity.get(answer.activityId) ?? [];
    list.push(answer);
    followUpsByActivity.set(answer.activityId, list);
  }

  type RawItem = {
    id?: unknown;
    title?: unknown;
    category?: unknown;
    organisation?: unknown;
    organization?: unknown;
    level?: unknown;
    year?: unknown;
    period?: unknown;
    competition?: unknown;
    detail?: unknown;
    description?: unknown;
    reflection?: unknown;
    reflectionCard?: unknown;
    reflection_card?: unknown;
    evidenceKey?: unknown;
    evidence_key?: unknown;
    reviewStatus?: unknown;
    review_status?: unknown;
    sourceType?: unknown;
    source_type?: unknown;
    sources?: unknown;
  };
  const mapItems = (items: unknown, prefix: 'achievement' | 'activity') =>
    (Array.isArray(items) ? items : []).flatMap((raw) => {
      const item = raw as RawItem;
      const id = typeof item.id === 'string' ? item.id : null;
      if (!id) return [];
      const activityId = `${prefix}:${id}`;
      return [
        {
          id: activityId,
          title: typeof item.title === 'string' ? item.title : 'Untitled',
          category: typeof item.category === 'string' ? item.category : null,
          organisation:
            typeof (item.organisation ?? item.organization) === 'string'
              ? String(item.organisation ?? item.organization)
              : null,
          level: typeof item.level === 'string' ? item.level : null,
          year: typeof item.year === 'number' ? item.year : null,
          period: typeof item.period === 'string' ? item.period : null,
          competition: typeof item.competition === 'string' ? item.competition : null,
          freeText:
            typeof item.detail === 'string'
              ? item.detail
              : typeof item.description === 'string'
                ? item.description
                : null,
          reflection:
            item.reflection && typeof item.reflection === 'object'
              ? (item.reflection as Record<string, unknown>)
              : null,
          reflectionCard:
            (item.reflectionCard ?? item.reflection_card) &&
            typeof (item.reflectionCard ?? item.reflection_card) === 'object'
              ? ((item.reflectionCard ?? item.reflection_card) as Record<string, unknown>)
              : null,
          reviewStatus:
            typeof (item.reviewStatus ?? item.review_status) === 'string'
              ? String(item.reviewStatus ?? item.review_status)
              : null,
          sourceType:
            typeof (item.sourceType ?? item.source_type) === 'string'
              ? String(item.sourceType ?? item.source_type)
              : null,
          sources: Array.isArray(item.sources) ? item.sources : [],
          evidenceKey:
            typeof (item.evidenceKey ?? item.evidence_key) === 'string' &&
            String(item.evidenceKey ?? item.evidence_key).trim()
              ? String(item.evidenceKey ?? item.evidence_key)
              : null,
          followUpAnswers: followUpsByActivity.get(id) ?? [],
        },
      ];
    });

  const achievements = mapItems(reflection['achievements'], 'achievement');
  // Activities only -- achievements stay in their own list (and in the
  // evidence bank); the state's `activities` mirrors the snapshot's
  // activities slice exactly.
  const activities = mapItems(reflection['activities'], 'activity');

  const evidenceBank = [
    ...achievements.map((item) => ({
      id: item.id,
      kind: 'achievement' as const,
      label: item.title,
      raw: item,
    })),
    ...activities.map((item) => ({
      id: item.id,
      kind: 'activity' as const,
      label: item.title,
      raw: item,
    })),
    ...(Array.isArray(row.payload?.documents)
      ? row.payload!.documents!.flatMap((doc) => {
          const document = doc as { id?: unknown; fileName?: unknown };
          const id = typeof document.id === 'string' ? document.id : null;
          if (!id) return [];
          return [
            {
              id: `document:${id}`,
              kind: 'document' as const,
              label: typeof document.fileName === 'string' ? document.fileName : 'Document',
              raw: doc,
            },
          ];
        })
      : []),
    ...Object.entries(reflection)
      .filter(([key]) => key !== 'achievements' && key !== 'activities')
      .map(([key, value]) => ({
        id: `profile:${key}`,
        kind: 'profile' as const,
        label: key.replaceAll('_', ' '),
        raw: value,
      })),
    ...followUps.map((answer, index) => ({
      id: `follow_up:${answer.activityId}:${answer.dimension}:${index}`,
      kind: 'follow_up' as const,
      label: `${answer.dimension}: ${answer.question}`.slice(0, 200),
      raw: answer,
    })),
  ];

  const academicRecordsRaw = Array.isArray(row.payload?.academicRecords)
    ? row.payload!.academicRecords!
    : [];
  const personalReflectionAnswers =
    reflection['personal_reflection_answers'] &&
    typeof reflection['personal_reflection_answers'] === 'object'
      ? (reflection['personal_reflection_answers'] as Record<string, unknown>)
      : reflection['personalReflection'] && typeof reflection['personalReflection'] === 'object'
        ? (reflection['personalReflection'] as Record<string, unknown>)
        : {};
  const careerInterests = Array.isArray(reflection['career_interests'])
    ? reflection['career_interests'].filter((value): value is string => typeof value === 'string').join(', ')
    : typeof reflection['career_interests'] === 'string'
      ? reflection['career_interests']
      : null;
  const intendedProfileDirection = [
    typeof reflection['goals'] === 'string'
      ? reflection['goals']
      : typeof reflection['careerGoal'] === 'string'
        ? reflection['careerGoal']
        : null,
    ...(Array.isArray(reflection['target_subjects'])
      ? reflection['target_subjects'].filter((value): value is string => typeof value === 'string')
      : Array.isArray(reflection['majors'])
        ? reflection['majors'].filter((value): value is string => typeof value === 'string')
        : []),
    careerInterests,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('; ');

  return {
    applicantId: row.user_id,
    applicationId: row.application_id,
    snapshotId: row.id,
    academicProfile: {
      records: academicRecordsRaw as AcademicRecord[],
      gradesSummary:
        typeof reflection['grades_summary'] === 'string' ? reflection['grades_summary'] : null,
      curriculum: typeof reflection['curriculum'] === 'string' ? reflection['curriculum'] : null,
    },
    achievements,
    activities,
    evidenceBank,
    directionSignals: {
      intendedDirection: intendedProfileDirection || null,
      academicDirection:
        typeof personalReflectionAnswers.q5 === 'string' ? personalReflectionAnswers.q5 : null,
      careerDirection:
        careerInterests
          ? careerInterests
          : typeof personalReflectionAnswers.q6 === 'string'
            ? personalReflectionAnswers.q6
            : null,
      preferredEnvironment:
        typeof personalReflectionAnswers.q7 === 'string' ? personalReflectionAnswers.q7 : null,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      sourceFingerprints: {
        // Prefer the stored hash; fall back to recomputing it from the payload.
        snapshotPayloadHash:
          (row.payload_hash as string | null) ??
          createHash('sha256').update(canonicalSnapshotPayloadString(row.payload)).digest('hex'),
      },
      supersedesSnapshotId: (row.supersedes_snapshot_id as string | null) ?? undefined,
      schemaVersion: row.schema_version ?? null,
    },
  };
}

/**
 * Rebuilds the v2 pipeline's `CandidateContext` from an ApplicantAIState
 * (Task 8). The state was itself reconstructed ONLY from the confirmed
 * snapshot, so this converter inherits that isolation: no live table can
 * influence the report input. Field mapping mirrors what
 * `loadCandidateContext` produces from live rows — achievements carry their
 * free text under `detail`, activities under `description` — so
 * `buildProfileEvaluationInput` needs no changes.
 */
export function candidateContextFromState(state: ApplicantAIState): import('@/features/apply/domain').CandidateContext {
  const profile: Record<string, unknown> = {};
  for (const item of state.evidenceBank) {
    if (item.kind === 'profile') {
      const key = item.id.slice('profile:'.length);
      profile[key] = item.raw;
    }
  }
  // Confirmed snapshots store the Reflection form's camelCase keys, while
  // live CandidateContext uses the profile table's snake_case names. Expose
  // both aliases so the report/matching stages consume the same frozen facts.
  const aliases: Record<string, string> = {
    majors: 'target_subjects',
    careerGoal: 'goals',
    studyMotivation: 'study_motivation',
    subjectMotivations: 'subject_motivations',
    personalReflection: 'personal_reflection_answers',
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (profile[to] === undefined && profile[from] !== undefined) profile[to] = profile[from];
  }

  const achievementRows = state.achievements.map((item) => ({
    id: item.id.slice('achievement:'.length),
    title: item.title,
    category: item.category ?? null,
    organisation: item.organisation ?? null,
    level: item.level ?? null,
    year: item.year ?? null,
    period: item.period ?? null,
    competition: item.competition ?? null,
    detail: item.freeText,
    reflection: item.reflection ?? null,
    reflection_card: item.reflectionCard ?? null,
    review_status: item.reviewStatus ?? null,
    source_type: item.sourceType ?? null,
    sources: item.sources ?? [],
    evidence_key: item.evidenceKey ?? null,
  }));

  const activityRows = state.activities.map((item) => ({
    id: item.id.slice('activity:'.length),
    title: item.title,
    category: item.category ?? null,
    organisation: item.organisation ?? null,
    level: item.level ?? null,
    year: item.year ?? null,
    period: item.period ?? null,
    competition: item.competition ?? null,
    description: [
      item.freeText,
      ...(item.followUpAnswers ?? []).map(
        (answer) => `Question: ${answer.question}\nAnswer: ${answer.answer}`,
      ),
    ]
      .filter(Boolean)
      .join('\n'),
    reflection: item.reflection ?? null,
    reflection_card: item.reflectionCard ?? null,
    review_status: item.reviewStatus ?? null,
    source_type: item.sourceType ?? null,
    sources: item.sources ?? [],
    evidence_key: item.evidenceKey ?? null,
  }));

  const englishTests = (state.academicProfile?.records ?? [])
    .filter((record) => record.kind === 'english_test')
    .map((record, index) => ({
      id: record.id ?? `english-${index}`,
      test_type: record.testType ?? null,
      overall_score: record.value,
    }));

  const standardizedTests = (state.academicProfile?.records ?? [])
    .filter((record) => record.kind === 'standardized_test')
    .map((record, index) => ({
      id: record.id ?? `standardized-${index}`,
      test_type: record.testType ?? null,
      score: record.value,
    }));

  const documents = state.evidenceBank
    .filter((item) => item.kind === 'document')
    .flatMap((item) => {
      const raw = (item.raw ?? {}) as { id?: unknown; type?: unknown; fileName?: unknown };
      const id = typeof raw.id === 'string' ? raw.id : item.id.slice('document:'.length);
      return [
        {
          id,
          type: typeof raw.type === 'string' ? raw.type : 'other',
          file_name: typeof raw.fileName === 'string' ? raw.fileName : item.label,
        },
      ];
    });

  const label = (kind: string, item: { title?: string; label: string }): string =>
    (item.title || item.label || kind).slice(0, 240);

  const evidence: import('@/features/apply/domain').EvidenceRef[] = [
    ...achievementRows.map((row) => ({ id: `achievement:${row.id}`, kind: 'achievement' as const, label: label('achievement', { title: row.title, label: '' }) })),
    ...activityRows.map((row) => ({ id: `activity:${row.id}`, kind: 'activity' as const, label: label('activity', { title: row.title, label: '' }) })),
    ...englishTests.map((row) => ({
      id: `english_test:${row.id}`,
      kind: 'english_test' as const,
      label: `${String(row.test_type || 'English test')} ${String(row.overall_score ?? '')}`.trim().slice(0, 240) || 'English test',
    })),
    ...standardizedTests.map((row) => ({
      id: `standardized_test:${row.id}`,
      kind: 'standardized_test' as const,
      label: `${String(row.test_type || 'Standardized test')} ${String(row.score ?? '')}`.trim().slice(0, 240) || 'Standardized test',
    })),
    ...documents.map((row) => ({ id: `document:${row.id}`, kind: 'document' as const, label: String(row.file_name).slice(0, 240) })),
  ];

  return {
    profile,
    achievements: achievementRows,
    activities: activityRows,
    englishTests,
    standardizedTests,
    documents,
    evidence,
  };
}
