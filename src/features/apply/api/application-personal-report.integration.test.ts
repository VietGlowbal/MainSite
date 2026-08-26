import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersonalReportV2 } from '../domain/personal-report';
import {
  createPersonalReportV2Version,
  getApplicationPersonalReportSupplements,
  getApplicationPersonalReportV2Version,
  getLatestApplicationPersonalReportV2,
  getPersonalReportV2Version,
  listApplicationPersonalReportV2Versions,
  saveApplicationPersonalReportSupplement,
} from './personal-report-v2-repository';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[]; error: null };

type MemoryDatabase = {
  client: SupabaseClient;
  rows: (table: string) => Row[];
  seed: (table: string, row: Row) => void;
};

/**
 * Small PostgREST-shaped fixture for repository isolation tests. The unique
 * cache-key race is synchronous here, which is enough to model two requests
 * entering the database at the same time without requiring a live Supabase
 * project in CI.
 */
function memoryDatabase(): MemoryDatabase {
  const tables = new Map<string, Row[]>();
  let insertSequence = 0;

  const client = {
    from(table: string) {
      const tableRows = () => {
        const existing = tables.get(table);
        if (existing) return existing;
        const created: Row[] = [];
        tables.set(table, created);
        return created;
      };

      let filters: Array<[string, unknown]> = [];
      let orderColumn: string | null = null;
      let ascending = true;
      let limitValue: number | null = null;
      let pendingRows: Row[] = [];
      let pendingError: { code: string; message: string } | null = null;

      const builder: Record<string, (...args: never[]) => unknown> = {};
      const execute = () => {
        let result = tableRows().filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        );
        if (orderColumn) {
          const column = orderColumn;
          result = [...result].sort((left, right) => {
            const leftValue = String(left[column] ?? '');
            const rightValue = String(right[column] ?? '');
            return ascending
              ? leftValue.localeCompare(rightValue)
              : rightValue.localeCompare(leftValue);
          });
        }
        return limitValue === null ? result : result.slice(0, limitValue);
      };

      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters = [...filters, [column, value]];
        return builder;
      };
      builder.order = (column: string, options?: { ascending?: boolean }) => {
        orderColumn = column;
        ascending = options?.ascending ?? true;
        return builder;
      };
      builder.limit = (value: number) => {
        limitValue = value;
        return builder;
      };
      builder.maybeSingle = async () => ({ data: execute()[0] ?? null, error: null });
      builder.single = async () => ({
        data: pendingRows[0] ?? execute()[0] ?? null,
        error: pendingError,
      });
      builder.insert = (payload: Row | Row[]) => {
        const rowsToInsert = Array.isArray(payload) ? payload : [payload];
        const duplicate = rowsToInsert.some(
          (row) =>
            row.application_id &&
            row.cache_key &&
            tableRows().some(
              (existing) =>
                existing.application_id === row.application_id &&
                existing.cache_key === row.cache_key,
            ),
        );
        if (duplicate) {
          pendingRows = [];
          pendingError = {
            code: '23505',
            message: 'duplicate key value violates unique constraint "uq_personal_report_application_cache_key"',
          };
          return builder;
        }

        pendingRows = rowsToInsert.map((row) => {
          const sequence = insertSequence++;
          const sequenceTime = new Date(Date.UTC(2026, 7, 26, 0, 0, sequence)).toISOString();
          return {
            ...row,
            id: row.id ?? `report-${sequence}`,
            created_at: sequenceTime,
            generated_at: sequenceTime,
          };
        });
        pendingError = null;
        tableRows().push(...pendingRows);
        return builder;
      };
      builder.upsert = async (payload: Row) => {
        const rows = tableRows();
        const index = rows.findIndex(
          (row) =>
            row.user_id === payload.user_id &&
            row.application_id === payload.application_id &&
            row.field_key === payload.field_key,
        );
        if (index === -1) rows.push({ ...payload });
        else rows[index] = { ...rows[index], ...payload };
        return { error: null };
      };
      builder.then = (
        onFulfilled?: ((value: QueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve({ data: execute(), error: null }).then(onFulfilled ?? undefined, onRejected ?? undefined);

      return builder;
    },
  } as unknown as SupabaseClient;

  return {
    client,
    rows: (table: string) => tables.get(table) ?? [],
    seed: (table: string, row: Row) => {
      const rows = tables.get(table) ?? [];
      rows.push(row);
      tables.set(table, rows);
    },
  };
}

function report(label: string): PersonalReportV2 {
  return {
    generatedAt: `2026-08-26T00:00:00.000Z`,
    overallEvidenceConfidence: 'medium',
    coreIdentity: { label },
    drivingForce: { label },
    signaturePattern: { label },
    emergingThemes: { label },
    personalPositioning: { label },
    proofOfMe: { label },
  } as unknown as PersonalReportV2;
}

async function createReport(
  database: MemoryDatabase,
  args: {
    applicationId?: string;
    snapshotId?: string;
    analysisId?: string;
    cacheKey?: string;
    trigger?: 'manual' | 'matching_report' | 'supplement_answer';
    label: string;
  },
) {
  return createPersonalReportV2Version(database.client, {
    userId: 'user-1',
    reportV2: report(args.label),
    evaluation: {} as never,
    inputHash: `${args.label}-input`,
    engineVersion: 'engine-v1',
    promptVersion: 'prompt-v1',
    modelName: 'test-model',
    trigger: args.trigger ?? 'manual',
    ...(args.applicationId ? { applicationId: args.applicationId } : {}),
    ...(args.snapshotId ? { confirmedSnapshotId: args.snapshotId } : {}),
    ...(args.analysisId ? { sourceAnalysisVersionId: args.analysisId } : {}),
    ...(args.applicationId ? { reportContractVersion: 'personal-report-v3' } : {}),
    ...(args.cacheKey ? { cacheKey: args.cacheKey } : {}),
  });
}

describe('application Personal Report persistence integration', () => {
  let database: MemoryDatabase;

  beforeEach(() => {
    database = memoryDatabase();
  });

  it('keeps application histories and report lineage isolated across snapshot revisions', async () => {
    const legacy = await createReport(database, { label: 'legacy' });
    const a1 = await createReport(database, {
      applicationId: 'app-a',
      snapshotId: 'snapshot-a1',
      analysisId: 'analysis-a1',
      cacheKey: 'cache-a1',
      label: 'A1',
    });
    const b1 = await createReport(database, {
      applicationId: 'app-b',
      snapshotId: 'snapshot-b1',
      analysisId: 'analysis-b1',
      cacheKey: 'cache-b1',
      label: 'B1',
    });

    const a1BeforeB = await getLatestApplicationPersonalReportV2(database.client, {
      userId: 'user-1',
      applicationId: 'app-a',
    });
    expect(a1BeforeB.record?.reportV2).toEqual(report('A1'));
    expect(a1BeforeB.record?.confirmedSnapshotId).toBe('snapshot-a1');
    expect(a1BeforeB.record?.sourceAnalysisVersionId).toBe('analysis-a1');

    const a2 = await createReport(database, {
      applicationId: 'app-a',
      snapshotId: 'snapshot-a2',
      analysisId: 'analysis-a2',
      cacheKey: 'cache-a2',
      label: 'A2',
    });

    const aHistory = await listApplicationPersonalReportV2Versions(database.client, {
      userId: 'user-1',
      applicationId: 'app-a',
    });
    const bHistory = await listApplicationPersonalReportV2Versions(database.client, {
      userId: 'user-1',
      applicationId: 'app-b',
    });
    expect(aHistory.versions.map((version) => version.id)).toEqual([a2.record?.id, a1.record?.id]);
    expect(bHistory.versions.map((version) => version.id)).toEqual([b1.record?.id]);

    const aLatest = await getLatestApplicationPersonalReportV2(database.client, {
      userId: 'user-1',
      applicationId: 'app-a',
    });
    const bLatest = await getLatestApplicationPersonalReportV2(database.client, {
      userId: 'user-1',
      applicationId: 'app-b',
    });
    expect(aLatest.record?.reportV2).toEqual(report('A2'));
    expect(bLatest.record?.reportV2).toEqual(report('B1'));
    expect(aLatest.record?.reportV2).not.toEqual(bLatest.record?.reportV2);

    const aEvidenceLineage = await getApplicationPersonalReportV2Version(
      database.client,
      { userId: 'user-1', applicationId: 'app-a' },
      a1.record!.id,
    );
    expect(aEvidenceLineage.record).toMatchObject({
      applicationId: 'app-a',
      confirmedSnapshotId: 'snapshot-a1',
      sourceAnalysisVersionId: 'analysis-a1',
    });
    const crossApplicationVersion = await getApplicationPersonalReportV2Version(
      database.client,
      { userId: 'user-1', applicationId: 'app-a' },
      b1.record!.id,
    );
    expect(crossApplicationVersion.record).toBeNull();

    const legacyRead = await getPersonalReportV2Version(
      database.client,
      'user-1',
      legacy.record!.id,
    );
    expect(legacyRead.record).toMatchObject({ id: legacy.record?.id, applicationId: null });
  });

  it('keeps report-only supplements application-local', async () => {
    await saveApplicationPersonalReportSupplement(database.client, {
      userId: 'user-1',
      applicationId: 'app-a',
      fieldKey: 'study_motivation',
      answer: 'A motivation',
    });
    await saveApplicationPersonalReportSupplement(database.client, {
      userId: 'user-1',
      applicationId: 'app-b',
      fieldKey: 'study_motivation',
      answer: 'B motivation',
    });

    await expect(
      getApplicationPersonalReportSupplements(database.client, {
        userId: 'user-1',
        applicationId: 'app-a',
      }),
    ).resolves.toEqual({ study_motivation: 'A motivation' });
    await expect(
      getApplicationPersonalReportSupplements(database.client, {
        userId: 'user-1',
        applicationId: 'app-b',
      }),
    ).resolves.toEqual({ study_motivation: 'B motivation' });
  });

  it('resolves concurrent non-force inserts to one cache row', async () => {
    const args = {
      applicationId: 'app-a',
      snapshotId: 'snapshot-a1',
      analysisId: 'analysis-a1',
      cacheKey: 'cache-concurrent-a1',
      label: 'concurrent',
    } as const;
    const [first, second] = await Promise.all([
      createReport(database, args),
      createReport(database, args),
    ]);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.record?.id).toBe(second.record?.id);
    expect(
      database.rows('student_personal_report_versions').filter(
        (row) => row.cache_key === 'cache-concurrent-a1',
      ),
    ).toHaveLength(1);
  });
});
