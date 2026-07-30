import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLookupSingle = vi.fn();
const mockWriteSingle = vi.fn();
const mockWriteSelect = vi.fn(() => ({ single: mockWriteSingle }));
const mockLookupEq = vi.fn(() => ({ maybeSingle: mockLookupSingle }));
const mockSelect = vi.fn(() => ({ eq: mockLookupEq }));
const mockUpdateEq = vi.fn(() => ({
  error: null,
  select: mockWriteSelect,
}));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockInsert = vi.fn(() => ({ select: mockWriteSelect }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  createIngestionJob,
  markJobCacheHit,
  recordIngestionJobFailure,
} from '@/lib/ingestion/ingestion-job-queue';

const MOCK_JOB = {
  id: 'job-uuid-1',
  application_id: 'app-uuid-1',
  user_id: 'user-uuid-1',
  university_id: 1,
  institution_id: 'supabase-1',
  submitted_url: 'https://university.edu/ms-cs',
  canonical_url: 'https://university.edu/ms-cs',
  status: 'pending',
  stage: 'queued',
  progress_percentage: 0,
  attempts: 0,
  max_attempts: 3,
  next_attempt_at: new Date().toISOString(),
  locked_at: null,
  locked_by: null,
  result_run_id: null,
  result_programme_id: null,
  cache_hit: null,
  error_code: null,
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  started_at: null,
  completed_at: null,
};

const CREATE_INPUT = {
  applicationId: 'app-uuid-1',
  userId: 'user-uuid-1',
  universityId: 1,
  institutionId: 'supabase-1',
  submittedUrl: 'https://university.edu/ms-cs',
  canonicalUrl: 'https://university.edu/ms-cs',
};

describe('ingestion-job-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupSingle.mockResolvedValue({ data: null, error: null });
    mockWriteSingle.mockResolvedValue({ data: MOCK_JOB, error: null });
  });

  describe('createIngestionJob', () => {
    it('inserts a new pending job', async () => {
      const job = await createIngestionJob(CREATE_INPUT);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          application_id: 'app-uuid-1',
          user_id: 'user-uuid-1',
          status: 'pending',
          stage: 'queued',
          attempts: 0,
        })
      );
      expect(job).toEqual(MOCK_JOB);
    });

    it('does not reset an active existing job', async () => {
      mockLookupSingle.mockResolvedValueOnce({
        data: { ...MOCK_JOB, status: 'processing', attempts: 1 },
        error: null,
      });

      const job = await createIngestionJob(CREATE_INPUT);

      expect(job.status).toBe('processing');
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('resets a failed job instead of creating a duplicate', async () => {
      mockLookupSingle.mockResolvedValueOnce({
        data: { ...MOCK_JOB, status: 'failed', attempts: 3 },
        error: null,
      });

      await createIngestionJob(CREATE_INPUT);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          attempts: 0,
          locked_at: null,
        })
      );
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('throws when the lookup fails', async () => {
      mockLookupSingle.mockResolvedValueOnce({
        data: null,
        error: new Error('DB error'),
      });
      await expect(createIngestionJob(CREATE_INPUT)).rejects.toThrow('DB error');
    });
  });

  it('marks a cache hit complete', async () => {
    await markJobCacheHit('job-uuid-1', 'run-uuid-1', 'prog-uuid-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'complete',
        cache_hit: true,
        result_run_id: 'run-uuid-1',
      })
    );
  });

  describe('recordIngestionJobFailure', () => {
    it('schedules a retry below max attempts', async () => {
      await recordIngestionJobFailure('job-1', 'FETCH_FAILED', 'timeout', {
        shouldRetry: true,
        attempts: 1,
        maxAttempts: 3,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retry',
          next_attempt_at: expect.any(String),
        })
      );
    });

    it('fails a retryable job at max attempts', async () => {
      await recordIngestionJobFailure('job-1', 'FETCH_FAILED', 'timeout', {
        shouldRetry: true,
        attempts: 3,
        maxAttempts: 3,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          completed_at: expect.any(String),
        })
      );
    });

    it('fails a non-retryable error immediately', async () => {
      await recordIngestionJobFailure('job-1', 'INVALID_URL', 'bad url', {
        shouldRetry: false,
        attempts: 1,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          completed_at: expect.any(String),
        })
      );
    });
  });
});
