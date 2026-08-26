import { describe, expect, it, vi } from 'vitest';
import {
  createPersonalReportV2Version,
  findPersonalReportV2ByCacheKey,
  getLatestApplicationPersonalReportV2,
  getLatestPersonalReportV2,
  getApplicationPersonalReportV2Version,
  getPersonalReportSupplements,
  getPersonalReportV2Version,
  listApplicationPersonalReportV2Versions,
  listPersonalReportV2Versions,
  savePersonalReportSupplement,
} from './personal-report-v2-repository';

const MINIMAL_REPORT = {
  coreIdentity: {},
  drivingForce: {},
  signaturePattern: {},
  emergingThemes: {},
  personalPositioning: {},
  proofOfMe: {},
  overallEvidenceConfidence: 'low',
};

describe('getLatestPersonalReportV2', () => {
  it('returns the newest version for the signed-in user', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'v2',
                    report_v2: MINIMAL_REPORT,
                    structured_evaluation: null,
                    evaluation_engine_version: '1.1.0',
                    input_hash: 'hash-2',
                    prompt_version: 'p2',
                    model_name: 'gpt-4o',
                    trigger: 'matching_report',
                    generated_at: '2026-08-14T00:00:00.000Z',
                    created_at: '2026-08-14T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const { record, migrationMissing } = await getLatestPersonalReportV2(supabase as never, 'user-1');
    expect(migrationMissing).toBe(false);
    expect(record?.id).toBe('v2');
    expect(record?.trigger).toBe('matching_report');
  });

  it('returns null with no error when no version exists yet', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const { record, migrationMissing } = await getLatestPersonalReportV2(supabase as never, 'user-1');
    expect(record).toBeNull();
    expect(migrationMissing).toBe(false);
  });

  it('degrades to migrationMissing when the versions table does not exist yet', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
              }),
            }),
          }),
        }),
      }),
    };

    const { record, migrationMissing } = await getLatestPersonalReportV2(supabase as never, 'user-1');
    expect(record).toBeNull();
    expect(migrationMissing).toBe(true);
  });
});

describe('listPersonalReportV2Versions', () => {
  it('returns every version summary, newest first, defaulting a null trigger to manual', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                { id: 'v2', generated_at: '2026-08-14T00:00:00.000Z', trigger: 'matching_report' },
                { id: 'v1', generated_at: '2026-08-13T00:00:00.000Z', trigger: null },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const { versions, migrationMissing } = await listPersonalReportV2Versions(supabase as never, 'user-1');
    expect(migrationMissing).toBe(false);
    expect(versions).toEqual([
      { id: 'v2', generatedAt: '2026-08-14T00:00:00.000Z', trigger: 'matching_report' },
      { id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' },
    ]);
  });

  it('degrades to an empty list when the versions table does not exist yet', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
          }),
        }),
      }),
    };

    const { versions, migrationMissing } = await listPersonalReportV2Versions(supabase as never, 'user-1');
    expect(versions).toEqual([]);
    expect(migrationMissing).toBe(true);
  });
});

describe('getPersonalReportV2Version', () => {
  it('returns a specific version only when it belongs to the requesting user', async () => {
    let capturedFilters: Record<string, unknown> = {};
    const supabase = {
      from: () => ({
        select: () => ({
          eq: (column: string, value: unknown) => {
            capturedFilters = { ...capturedFilters, [column]: value };
            return {
              eq: (column2: string, value2: unknown) => {
                capturedFilters = { ...capturedFilters, [column2]: value2 };
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: 'v1',
                      report_v2: MINIMAL_REPORT,
                      structured_evaluation: null,
                      evaluation_engine_version: '1.1.0',
                      input_hash: 'hash-1',
                      prompt_version: 'p1',
                      model_name: 'gpt-4o',
                      trigger: 'manual',
                      generated_at: '2026-08-13T00:00:00.000Z',
                      created_at: '2026-08-13T00:00:00.000Z',
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        }),
      }),
    };

    const { record } = await getPersonalReportV2Version(supabase as never, 'user-1', 'v1');
    expect(record?.id).toBe('v1');
    expect(capturedFilters).toEqual({ id: 'v1', user_id: 'user-1' });
  });

  it('returns null when the version does not exist or is not owned by this user', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };

    const { record } = await getPersonalReportV2Version(supabase as never, 'user-1', 'not-mine');
    expect(record).toBeNull();
  });
});

describe('createPersonalReportV2Version', () => {
  it('inserts a new version row and returns its id/generatedAt', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'v3', generated_at: '2026-08-14T01:00:00.000Z' }, error: null }),
      }),
    });
    const supabase = { from: () => ({ insert }) };

    const { record, error } = await createPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      reportV2: MINIMAL_REPORT as never,
      evaluation: {} as never,
      inputHash: 'hash-3',
      engineVersion: '1.1.0',
      promptVersion: 'p3',
      modelName: 'gpt-4o',
      trigger: 'supplement_answer',
    });

    expect(error).toBeNull();
    expect(record).toEqual({ id: 'v3', generatedAt: '2026-08-14T01:00:00.000Z' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', input_hash: 'hash-3', trigger: 'supplement_answer' }),
    );
  });

  it('reports migrationMissing when the versions table does not exist yet', async () => {
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
          }),
        }),
      }),
    };

    const { record, error } = await createPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      reportV2: MINIMAL_REPORT as never,
      evaluation: {} as never,
      inputHash: 'hash-4',
      engineVersion: '1.1.0',
      promptVersion: 'p4',
      modelName: 'gpt-4o',
      trigger: 'manual',
    });

    expect(record).toBeNull();
    expect(error?.migrationMissing).toBe(true);
  });
});

describe('getPersonalReportSupplements', () => {
  it('returns a fieldKey -> answer map for the signed-in user', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              { field_key: 'study_motivation', answer: 'I want to build accessible tools.' },
            ],
            error: null,
          }),
        }),
      }),
    };

    const result = await getPersonalReportSupplements(supabase as never, 'user-1');
    expect(result).toEqual({ study_motivation: 'I want to build accessible tools.' });
  });

  it('degrades to an empty object when the migration has not run yet', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
        }),
      }),
    };

    const result = await getPersonalReportSupplements(supabase as never, 'user-1');
    expect(result).toEqual({});
  });

  it('logs and degrades to an empty object on an unexpected error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: { code: '500', message: 'boom' } }),
        }),
      }),
    };

    const result = await getPersonalReportSupplements(supabase as never, 'user-1');
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('savePersonalReportSupplement', () => {
  it('upserts keyed on user_id + field_key', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: () => ({ upsert }) };

    const result = await savePersonalReportSupplement(supabase as never, {
      userId: 'user-1',
      fieldKey: 'study_motivation',
      answer: 'I want to build accessible tools.',
    });

    expect(result.error).toBeNull();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        field_key: 'study_motivation',
        answer: 'I want to build accessible tools.',
      }),
      { onConflict: 'user_id,field_key' },
    );
  });

  it('reports migrationMissing when the table does not exist yet', async () => {
    const supabase = {
      from: () => ({
        upsert: async () => ({ error: { code: '42P01', message: 'relation does not exist' } }),
      }),
    };

    const result = await savePersonalReportSupplement(supabase as never, {
      userId: 'user-1',
      fieldKey: 'study_motivation',
      answer: 'answer',
    });

    expect(result.error?.migrationMissing).toBe(true);
  });
});

// ── application-scoped reads/writes ─────────────────────────────────────────

const APP_ROW = {
  id: 'v9',
  report_v2: MINIMAL_REPORT,
  structured_evaluation: null,
  evaluation_engine_version: '1.1.0',
  input_hash: 'hash-9',
  prompt_version: 'p9',
  model_name: 'gpt-4o',
  trigger: 'manual',
  generated_at: '2026-08-26T00:00:00.000Z',
  created_at: '2026-08-26T00:00:00.000Z',
  application_id: 'app-a',
  confirmed_snapshot_id: 'snap-1',
  source_analysis_version_id: 'analysis-1',
  report_contract_version: 'v3',
  cache_key: 'key-9',
};

/** Chainable fake query builder that records every eq filter applied to it. */
function queryRecorder(final: { data: unknown; error: unknown }) {
  const filters: Record<string, unknown> = {};
  const api: Record<string, unknown> = { ...final };
  api.select = () => api;
  api.eq = (column: string, value: unknown) => {
    filters[column] = value;
    return api;
  };
  api.order = () => api;
  api.limit = () => api;
  api.maybeSingle = async () => final;
  api.single = async () => final;
  return { api: api as never, filters };
}

describe('getLatestApplicationPersonalReportV2', () => {
  it('filters by both user_id and application_id', async () => {
    const { api, filters } = queryRecorder({ data: APP_ROW, error: null });
    const supabase = { from: () => api };

    await getLatestApplicationPersonalReportV2(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    });

    expect(filters.user_id).toBe('user-1');
    expect(filters.application_id).toBe('app-a');
  });

  it('excludes legacy rows with application_id NULL from application history — SQL equality against a non-null value can never match a NULL row', async () => {
    // A legacy row (application_id IS NULL) is structurally invisible through
    // the `.eq('application_id', …)` filter; assert the filter is present so
    // no reader ever falls back to a user-level scan.
    const { api, filters } = queryRecorder({ data: APP_ROW, error: null });
    const supabase = { from: () => api };

    const { record } = await getLatestApplicationPersonalReportV2(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    });

    expect(filters.application_id).toBe('app-a');
    expect(record?.applicationId).toBe('app-a');
  });

  it('maps snapshot and analysis lineage onto the returned record', async () => {
    const { api } = queryRecorder({ data: APP_ROW, error: null });
    const supabase = { from: () => api };

    const { record } = await getLatestApplicationPersonalReportV2(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    });

    expect(record).toMatchObject({
      id: 'v9',
      applicationId: 'app-a',
      confirmedSnapshotId: 'snap-1',
      sourceAnalysisVersionId: 'analysis-1',
      reportContractVersion: 'v3',
      cacheKey: 'key-9',
    });
  });

  it('returns null when this application has no report yet (migration intact)', async () => {
    const { api } = queryRecorder({ data: null, error: null });
    const supabase = { from: () => api };

    const { record, migrationMissing } = await getLatestApplicationPersonalReportV2(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-b',
    });

    expect(record).toBeNull();
    expect(migrationMissing).toBe(false);
  });

  it('degrades to migrationMissing when the versions table does not exist yet', async () => {
    const { api } = queryRecorder({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
    const supabase = { from: () => api };

    const { record, migrationMissing } = await getLatestApplicationPersonalReportV2(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    });

    expect(record).toBeNull();
    expect(migrationMissing).toBe(true);
  });
});

describe('listApplicationPersonalReportV2Versions', () => {
  it('lists only versions of the requested application, newest first', async () => {
    const { api, filters } = queryRecorder({
      data: [
        { id: 'v9', generated_at: '2026-08-26T00:00:00.000Z', trigger: 'manual' },
        { id: 'v8', generated_at: '2026-08-25T00:00:00.000Z', trigger: null },
      ],
      error: null,
    });
    const supabase = { from: () => api };

    const { versions, migrationMissing } = await listApplicationPersonalReportV2Versions(
      supabase as never,
      { userId: 'user-1', applicationId: 'app-a' },
    );

    expect(filters.user_id).toBe('user-1');
    expect(filters.application_id).toBe('app-a');
    expect(migrationMissing).toBe(false);
    expect(versions).toEqual([
      { id: 'v9', generatedAt: '2026-08-26T00:00:00.000Z', trigger: 'manual' },
      { id: 'v8', generatedAt: '2026-08-25T00:00:00.000Z', trigger: 'manual' },
    ]);
  });
});

describe('getApplicationPersonalReportV2Version', () => {
  it('applies id, user_id AND application_id filters — a version from application B cannot be returned through application A', async () => {
    const { api, filters } = queryRecorder({ data: null, error: null }); // B's row never matches app A's filters
    const supabase = { from: () => api };

    const { record } = await getApplicationPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    }, 'version-of-app-b');

    expect(filters.id).toBe('version-of-app-b');
    expect(filters.user_id).toBe('user-1');
    expect(filters.application_id).toBe('app-a');
    expect(record).toBeNull();
  });

  it('maps lineage fields when the version belongs to the requesting application', async () => {
    const { api } = queryRecorder({ data: APP_ROW, error: null });
    const supabase = { from: () => api };

    const { record } = await getApplicationPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      applicationId: 'app-a',
    }, 'v9');

    expect(record?.id).toBe('v9');
    expect(record?.confirmedSnapshotId).toBe('snap-1');
  });
});

describe('createPersonalReportV2Version with lineage', () => {
  it('inserts snapshot and analysis lineage columns', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'v10', generated_at: '2026-08-26T01:00:00.000Z' }, error: null }),
      }),
    });
    const supabase = { from: () => ({ insert }) };

    const { error } = await createPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      reportV2: MINIMAL_REPORT as never,
      evaluation: {} as never,
      inputHash: 'hash-10',
      engineVersion: '1.1.0',
      promptVersion: 'p10',
      modelName: 'gpt-4o',
      trigger: 'manual',
      applicationId: 'app-a',
      confirmedSnapshotId: 'snap-2',
      sourceAnalysisVersionId: 'analysis-2',
      reportContractVersion: 'v3',
      cacheKey: 'key-10',
    });

    expect(error).toBeNull();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: 'app-a',
        confirmed_snapshot_id: 'snap-2',
        source_analysis_version_id: 'analysis-2',
        report_contract_version: 'v3',
        cache_key: 'key-10',
      }),
    );
  });
});

describe('findPersonalReportV2ByCacheKey', () => {
  it('repeated requests with the same cache key resolve to the same row for the same application', async () => {
    const first = queryRecorder({ data: APP_ROW, error: null });
    const second = queryRecorder({ data: APP_ROW, error: null });
    let call = 0;
    const supabase = {
      from: () => (call++ === 0 ? first.api : second.api),
    };
    const scope = { userId: 'user-1', applicationId: 'app-a' };

    const [a, b] = [
      await findPersonalReportV2ByCacheKey(supabase as never, scope, 'key-9'),
      await findPersonalReportV2ByCacheKey(supabase as never, scope, 'key-9'),
    ];

    expect(a.record?.id).toBe('v9');
    expect(b.record?.id).toBe(a.record?.id);
    expect(first.filters.cache_key).toBe('key-9');
    expect(first.filters.application_id).toBe('app-a');
  });

  it('resolves an insert that lost a unique cache-key race to the already-stored row instead of failing', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "uq_personal_report_application_cache_key"',
          },
        }),
      }),
    });
    const lookup = queryRecorder({ data: APP_ROW, error: null });
    let call = 0;
    const supabase = { from: () => (call++ === 0 ? { insert } : lookup.api) };

    const { record, error } = await createPersonalReportV2Version(supabase as never, {
      userId: 'user-1',
      reportV2: MINIMAL_REPORT as never,
      evaluation: {} as never,
      inputHash: 'hash-9',
      engineVersion: '1.1.0',
      promptVersion: 'p9',
      modelName: 'gpt-4o',
      trigger: 'manual',
      applicationId: 'app-a',
      confirmedSnapshotId: 'snap-1',
      sourceAnalysisVersionId: 'analysis-1',
      reportContractVersion: 'v3',
      cacheKey: 'key-9',
    });

    expect(error).toBeNull();
    expect(record?.id).toBe('v9');
    expect(insert).toHaveBeenCalled();
  });
});
