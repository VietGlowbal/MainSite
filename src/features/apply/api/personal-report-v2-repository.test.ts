import { describe, expect, it, vi } from 'vitest';
import { getPersonalReportSupplements, savePersonalReportSupplement } from './personal-report-v2-repository';

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
