import {
  canonicalSnapshotPayloadString,
} from '@/features/apply/api/candidate-snapshot-repository';
import { createHash } from 'crypto';
import type { ApplicantAIState } from './domain';

/**
 * Reconstructs the ApplicantAIState from ONE confirmed snapshot (Task 5).
 *
 * SNAPSHOT-ONLY BY CONSTRUCTION: this module's only database read is
 * `confirmed_candidate_snapshots`, filtered by user_id + application_id (+ id
 * when a specific snapshot is requested). There is no code path that could
 * reach `student_profiles`, `student_achievements`, or any other live table —
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

/** Pure converter — exported for tests and Task 8 reuse. */
export function stateFromSnapshotRow(row: SnapshotRow): ApplicantAIState {
  const reflection = row.payload?.reflection ?? {};
  const followUps = row.payload?.followUpAnswers ?? [];
  const followUpsByActivity = new Map<string, typeof followUps>();
  for (const answer of followUps) {
    const list = followUpsByActivity.get(answer.activityId) ?? [];
    list.push(answer);
    followUpsByActivity.set(answer.activityId, list);
  }

  type RawItem = { id?: unknown; title?: unknown; category?: unknown; detail?: unknown; description?: unknown };
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
          freeText:
            typeof item.detail === 'string'
              ? item.detail
              : typeof item.description === 'string'
                ? item.description
                : null,
          followUpAnswers: followUpsByActivity.get(id) ?? [],
        },
      ];
    });

  const achievements = mapItems(reflection['achievements'], 'achievement');
  // Activities only — achievements stay in their own list (and in the
  // evidence bank); the state's `activities` mirrors the snapshot's
  // activities slice exactly.
  const activities = mapItems(reflection['activities'], 'activity');

  const evidenceBank = [
    ...activities.map((item) => ({
      id: item.id,
      kind: item.id.startsWith('activity:') ? ('activity' as const) : ('achievement' as const),
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

  return {
    applicantId: row.user_id,
    applicationId: row.application_id,
    snapshotId: row.id,
    academicProfile: {
      records: academicRecordsRaw as ApplicantAIState['academicProfile'] extends undefined ? never[] : any[],
      gradesSummary:
        typeof reflection['grades_summary'] === 'string' ? reflection['grades_summary'] : null,
      curriculum: typeof reflection['curriculum'] === 'string' ? reflection['curriculum'] : null,
    },
    activities,
    evidenceBank,
    directionSignals: {
      intendedDirection: typeof reflection['goals'] === 'string' ? reflection['goals'] : null,
      careerDirection:
        typeof reflection['career_interests'] === 'string' ? reflection['career_interests'] : null,
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
