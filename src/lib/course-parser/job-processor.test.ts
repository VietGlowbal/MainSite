import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseExtraction } from './extract-course';
import type { CourseParseJob } from './job-queue';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  extractCourse: vi.fn(),
  resolveUniversity: vi.fn(),
  updateJobStatus: vi.fn(),
  recordJobFailure: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));
vi.mock('./extract-course', async () => {
  const actual = await vi.importActual<typeof import('./extract-course')>('./extract-course');
  return { ...actual, extractCourse: mocks.extractCourse };
});
vi.mock('@/features/universities/api', () => ({ resolveUniversity: mocks.resolveUniversity }));
vi.mock('./job-queue', async () => {
  const actual = await vi.importActual<typeof import('./job-queue')>('./job-queue');
  return {
    ...actual,
    updateJobStatus: mocks.updateJobStatus,
    recordJobFailure: mocks.recordJobFailure,
  };
});

import { processParseJob } from './job-processor';

function chainResult<T>(result: T) {
  const chain = {
    eq: vi.fn(),
    in: vi.fn(),
    select: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  return chain;
}

const extraction: CourseExtraction = {
  course: {
    universityName: 'Example University',
    universityLocalName: null,
    universityType: null,
    courseName: 'Computer Science',
    degreeLevel: 'Master',
    subject: 'Computing',
    studyMode: 'Full time',
    intake: 'September',
    country: 'United Kingdom',
    deadline: null,
    durationText: null,
    tuitionFeeText: null,
    applicationMethod: null,
    applicationCode: null,
    entryRequirements: null,
    englishRequirements: null,
    summary: null,
  },
  tasks: [],
  scholarships: [],
  links: {
    entryRequirements: null,
    howToApply: null,
    tuitionFees: null,
    scholarships: null,
  },
  confidence: 'high',
};

const job: CourseParseJob = {
  id: 'job-lease-race',
  application_id: 'app-lease-race',
  course_url: 'https://example.edu/course',
  university_id: null,
  status: 'processing',
  attempts: 1,
  max_attempts: 3,
  next_attempt_at: null,
  error_message: null,
  parsed_data: null,
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
  started_at: '2026-09-14T00:00:00.000Z',
  completed_at: null,
  locked_by: 'worker-lease-race',
};

describe('processParseJob lease ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractCourse.mockResolvedValue({ ok: true, data: extraction });
    mocks.updateJobStatus.mockResolvedValue(true);
    mocks.recordJobFailure.mockResolvedValue(true);
    mocks.resolveUniversity.mockResolvedValue({ status: 'skipped', reason: 'not-found' });

    let jobHeartbeatCount = 0;
    const jobTable = {
      update: vi.fn(() => {
        jobHeartbeatCount += 1;
        return chainResult({
          data: jobHeartbeatCount === 3 ? [] : [{ id: job.id }],
          error: null,
        });
      }),
      select: vi.fn(() => chainResult({ data: { parse_status: 'processing' }, error: null })),
    };
    const applicationTable = {
      update: vi.fn(() => chainResult({ data: [{ id: job.application_id }], error: null })),
      select: vi.fn(() => chainResult({ data: { parse_status: 'processing' }, error: null })),
    };
    const from = vi.fn((table: string) => table === 'course_parse_jobs' ? jobTable : applicationTable);
    mocks.admin.mockReturnValue({ from });
  });

  it('does not write checklist or sources after the final lease check loses ownership', async () => {
    const result = await processParseJob(job);

    expect(result).toEqual({
      applicationId: job.application_id,
      status: 'retry',
      reason: 'Parse job was reclaimed or completed by another worker.',
    });
    // fetching, validating, and the final pre-side-effect ownership check.
    expect(mocks.admin().from('course_parse_jobs').update).toHaveBeenCalledTimes(3);
    expect(mocks.admin().from).not.toHaveBeenCalledWith('application_stages');
    expect(mocks.admin().from).not.toHaveBeenCalledWith('application_tasks');
    expect(mocks.admin().from).not.toHaveBeenCalledWith('application_sources');
    expect(mocks.updateJobStatus).not.toHaveBeenCalled();
    expect(mocks.recordJobFailure).not.toHaveBeenCalled();
  });
});
