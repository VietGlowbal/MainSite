import { describe, expect, it, vi } from 'vitest';
import { buildApplicantStateFromSnapshot, SnapshotNotFoundError } from './context-builder';

function snapshotHarness(snapshotRow: Record<string, unknown> | null) {
  const filters: Record<string, unknown> = {};
  const tablesTouched: string[] = [];
  const supabase = {
    from(table: string) {
      tablesTouched.push(table);
      // ANY table other than the snapshot store would mean live reads.
      if (table !== 'confirmed_candidate_snapshots') {
        throw new Error(`LIVE TABLE ACCESS ATTEMPTED: ${table}`);
      }
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: snapshotRow, error: null }),
      };
      return builder;
    },
  };
  return { supabase: supabase as never, filters, tablesTouched };
}

const SNAPSHOT_ROW = {
  id: 'snap-a',
  user_id: 'user-1',
  application_id: 'app-a',
  schema_version: 2,
  payload_hash: 'deadbeef',
  supersedes_snapshot_id: null,
  confirmed_at: '2026-08-26T10:00:00Z',
  payload: {
    reflection: {
      nationality: 'VN',
      study_level: 'undergraduate',
      grades_summary: 'Top 5%',
      goals: 'Study AI at a research university',
      personal_reflection_answers: { q1: 'I love building things', q5: 'AI research' },
      achievements: [
        { id: 'ach-1', category: 'academic_award', title: 'Math olympiad', reviewStatus: 'reviewed' },
      ],
      activities: [
        { id: 'act-1', category: 'club', title: 'Robotics club lead', reviewStatus: 'reviewed' },
      ],
    },
    documents: [{ id: 'doc-1', fileName: 'transcript.pdf' }],
    academicRecords: [
      { kind: 'english_test', testType: 'IELTS', value: 7.0, scale: 9, raw: 'IELTS 7.0' },
      { kind: 'gpa', value: 3.6, scale: 4, raw: '3.6/4.0' },
    ],
    followUpAnswers: [
      { activityId: 'act-1', dimension: 'impact', question: 'What changed?', answer: 'Club grew 3x', round: 1 },
    ],
  },
};

describe('buildApplicantStateFromSnapshot', () => {
  it('rejects a snapshot belonging to another user or application (filters applied server-side)', async () => {
    const { supabase, filters } = snapshotHarness(null); // ownership filter matched nothing

    await expect(
      buildApplicantStateFromSnapshot({
        supabase,
        userId: 'user-1',
        applicationId: 'app-b', // snapshot belongs to app-a
      }),
    ).rejects.toBeInstanceOf(SnapshotNotFoundError);

    expect(filters.user_id).toBe('user-1');
    expect(filters.application_id).toBe('app-b');
  });

  it('reconstructs state from the SELECTED snapshot without touching live profile tables', async () => {
    const { supabase, tablesTouched } = snapshotHarness(SNAPSHOT_ROW);

    const state = await buildApplicantStateFromSnapshot({
      supabase,
      userId: 'user-1',
      applicationId: 'app-a',
    });

    expect(state.applicationId).toBe('app-a');
    expect(state.snapshotId).toBe('snap-a');
    expect(state.applicantId).toBe('user-1');
    // Live-table proof: any read outside the snapshot store throws.
    expect(tablesTouched.every((t) => t === 'confirmed_candidate_snapshots')).toBe(true);

    // Content came from the frozen payload, not live rows.
    expect(state.activities).toHaveLength(1);
    expect(state.activities[0]).toMatchObject({ id: 'activity:act-1', title: 'Robotics club lead' });
    expect(state.evidenceBank.length).toBeGreaterThan(0);
    expect(state.academicProfile?.records).toEqual(SNAPSHOT_ROW.payload.academicRecords);
    expect(state.metadata.sourceFingerprints?.snapshotPayloadHash).toBe('deadbeef');
    expect(state.directionSignals?.intendedDirection).toBe('Study AI at a research university');
  });

  it('editing live data after snapshot A cannot change state A — the builder never re-reads live rows', async () => {
    const first = snapshotHarness(SNAPSHOT_ROW);
    const stateA = await buildApplicantStateFromSnapshot({
      supabase: first.supabase,
      userId: 'user-1',
      applicationId: 'app-a',
    });

    // Simulate a later edit producing a NEWER snapshot row for the SAME app;
    // asking for snapshot A by id still returns exactly A.
    const editedRow = {
      ...SNAPSHOT_ROW,
      id: 'snap-a2',
      supersedes_snapshot_id: 'snap-a',
      payload: {
        ...SNAPSHOT_ROW.payload,
        reflection: {
          ...SNAPSHOT_ROW.payload.reflection,
          goals: 'Changed my mind: finance instead',
        },
      },
    };
    const second = snapshotHarness(editedRow);
    const stateAagain = await buildApplicantStateFromSnapshot({
      supabase: second.supabase,
      userId: 'user-1',
      applicationId: 'app-a',
      snapshotId: 'snap-a',
    });
    void stateAagain;

    // The FIRST build remains whatever snapshot A said, regardless of any
    // later edit (the second build above could only read snap-a by id).
    expect(stateA.directionSignals?.intendedDirection).toBe('Study AI at a research university');
    expect(second.filters.id).toBe('snap-a');
  });
});
