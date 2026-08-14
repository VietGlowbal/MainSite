import { describe, expect, it, vi } from 'vitest';
import {
  createPersonalReportV2Version,
  getLatestPersonalReportV2,
  getPersonalReportSupplements,
  getPersonalReportV2Version,
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
