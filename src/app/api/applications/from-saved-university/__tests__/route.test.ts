import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockEntitlement, mockSeedBaseline, mockCreateParseJob } = vi.hoisted(
  () => ({
    mockCreateClient: vi.fn(),
    mockEntitlement: vi.fn(),
    mockSeedBaseline: vi.fn(),
    mockCreateParseJob: vi.fn(),
  }),
);

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }));
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  canAddCoursesToApply: mockEntitlement,
}));
vi.mock('@/lib/course-parser/job-queue', () => ({ createParseJob: mockCreateParseJob }));
vi.mock('@/lib/course-parser/baseline-checklist', async () => {
  // The real error class, so `instanceof` in the route is exercised rather than
  // stubbed into always-false.
  const actual = await vi.importActual<typeof import('@/lib/course-parser/baseline-checklist')>(
    '@/lib/course-parser/baseline-checklist',
  );
  return { ...actual, seedBaselineChecklist: mockSeedBaseline };
});

import { BaselineNotEnabledError } from '@/lib/course-parser/baseline-checklist';
import { POST } from '../route';

type Fixture = {
  user?: { id: string } | null;
  savedRow?: Record<string, unknown> | null;
  duplicate?: { id: string } | null;
  university?: Record<string, unknown> | null;
};

const SAVED = { id: 7, university_id: 123, program: 'Computer Science', program_url: null };
const UNIVERSITY = { id: 123, name: 'Example University', country: 'United States' };

function buildSupabase(fixture: Fixture = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletes: string[] = [];

  const from = vi.fn((table: string) => {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.neq = vi.fn(() => builder);
    builder.insert = vi.fn((value: Record<string, unknown>) => {
      operation = 'insert';
      inserts.push({ ...value, __table: table });
      return builder;
    });
    builder.update = vi.fn((value: Record<string, unknown>) => {
      operation = 'update';
      updates.push({ ...value, __table: table });
      return builder;
    });
    builder.delete = vi.fn(() => {
      operation = 'delete';
      deletes.push(table);
      return builder;
    });
    builder.single = vi.fn(async () => {
      if (table === 'course_applications' && operation === 'insert') {
        return { data: { id: 'application-1' }, error: null };
      }
      return { data: null, error: null };
    });
    builder.maybeSingle = vi.fn(async () => {
      if (table === 'user_universities') {
        return {
          data: fixture.savedRow === undefined ? SAVED : fixture.savedRow,
          error: null,
        };
      }
      if (table === 'course_applications') {
        return { data: fixture.duplicate ?? null, error: null };
      }
      if (table === 'universities') {
        return {
          data: fixture.university === undefined ? UNIVERSITY : fixture.university,
          error: null,
        };
      }
      return { data: null, error: null };
    });
    // The bare `.update(...).eq(...).eq(...)` calls are awaited directly.
    builder.then = undefined as never;
    return builder;
  });

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: fixture.user === undefined ? { id: 'user-1' } : fixture.user },
        error: null,
      })),
    },
    from,
    inserts,
    updates,
    deletes,
  };
}

function request(body: unknown) {
  return new Request('http://localhost/api/applications/from-saved-university', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const application = (client: ReturnType<typeof buildSupabase>) =>
  client.inserts.find((row) => row.__table === 'course_applications');

beforeEach(() => {
  vi.clearAllMocks();
  mockEntitlement.mockResolvedValue({ allowed: true });
  mockSeedBaseline.mockResolvedValue({ stages: 5, tasks: 13 });
  mockCreateParseJob.mockResolvedValue({ id: 'job-1' });
});

describe('POST /api/applications/from-saved-university', () => {
  it('rejects unauthenticated requests', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase({ user: null }));
    const res = await POST(request({ universityId: 123 }));
    expect(res.status).toBe(401);
  });

  it('rejects a body with no university', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase());
    const res = await POST(request({}));
    expect(res.status).toBe(400);
  });

  it('404s for a university the student has not saved', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase({ savedRow: null }));
    const res = await POST(request({ universityId: 123 }));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ errorCode: 'NOT_SAVED' });
  });

  it('asks for a subject before creating anything', async () => {
    const client = buildSupabase({ savedRow: { ...SAVED, program: null } });
    mockCreateClient.mockResolvedValue(client);

    const res = await POST(request({ universityId: 123 }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      errorCode: 'SUBJECT_REQUIRED',
      universityId: 123,
    });
    expect(application(client)).toBeUndefined();
  });

  it('treats whitespace as no subject', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase({ savedRow: { ...SAVED, program: '   ' } }));
    const res = await POST(request({ universityId: 123 }));
    await expect(res.json()).resolves.toMatchObject({ errorCode: 'SUBJECT_REQUIRED' });
  });

  it('passes the quota refusal through with its usage, for the upgrade modal', async () => {
    mockEntitlement.mockResolvedValue({
      allowed: false,
      reason: 'limit reached',
      upgradeRequired: true,
      usage: { coursesAdded: 5, courseAddLimit: 5 },
    });
    mockCreateClient.mockResolvedValue(buildSupabase());

    const res = await POST(request({ universityId: 123 }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      upgradeRequired: true,
      usage: { courseAddLimit: 5 },
    });
  });

  it('answers 409 with the existing id when the subject is already planned', async () => {
    const client = buildSupabase({ duplicate: { id: 'existing-1' } });
    mockCreateClient.mockResolvedValue(client);

    const res = await POST(request({ universityId: 123 }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      duplicate: true,
      existingApplicationId: 'existing-1',
    });
    expect(application(client)).toBeUndefined();
  });

  it('creates the application with real values and no placeholders', async () => {
    const client = buildSupabase();
    mockCreateClient.mockResolvedValue(client);

    const res = await POST(request({ universityId: 123 }));
    expect(res.status).toBe(200);

    const row = application(client)!;
    expect(row).toMatchObject({
      university_id: 123,
      university_name: 'Example University',
      course_name: 'Computer Science',
      subject: 'Computer Science',
      country: 'United States',
      progress_percentage: 0,
    });
    // The pasted-URL path inserts these two literals and waits for a worker to
    // replace them. There is nothing pending here, so there is no placeholder.
    expect(row.course_name).not.toMatch(/loading course details/i);
    expect(row.university_name).not.toMatch(/unknown university/i);
  });

  it('does not copy the university deadline onto the course', async () => {
    // universities.application_deadline is institution-wide free prose;
    // course_applications.deadline is a date about one course.
    const client = buildSupabase({
      university: { ...UNIVERSITY, application_deadline: 'UCAS: Jan 15 | Graduate: Dec–Jan' },
    });
    mockCreateClient.mockResolvedValue(client);

    await POST(request({ universityId: 123 }));

    expect(application(client)).not.toHaveProperty('deadline');
  });

  it('seeds the baseline checklist', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase());
    await POST(request({ universityId: 123 }));
    expect(mockSeedBaseline).toHaveBeenCalledWith('application-1');
  });

  it('rolls the application back rather than shipping it with no checklist', async () => {
    mockSeedBaseline.mockRejectedValue(new Error('insert failed'));
    const client = buildSupabase();
    mockCreateClient.mockResolvedValue(client);

    const res = await POST(request({ universityId: 123 }));

    expect(res.status).toBe(500);
    expect(client.deletes).toContain('course_applications');
  });

  it('names the missing migration when the baseline is not switched on', async () => {
    mockSeedBaseline.mockRejectedValue(new BaselineNotEnabledError('created_by rejects system'));
    mockCreateClient.mockResolvedValue(buildSupabase());

    const res = await POST(request({ universityId: 123 }));

    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('supabase-apply-baseline-checklist.sql'),
    });
  });

  describe('enrichment', () => {
    it('queues nothing, and stays complete, when there is no course URL', async () => {
      const client = buildSupabase();
      mockCreateClient.mockResolvedValue(client);

      const res = await POST(request({ universityId: 123 }));

      expect(mockCreateParseJob).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({ enrichment: 'none' });
      // The row must not claim the AI is reading a page that does not exist.
      expect(application(client)).toMatchObject({ parse_status: 'complete' });
      expect(client.updates.some((u) => u.parse_status === 'pending')).toBe(false);
    });

    it('queues the parse and marks the row pending when there is one', async () => {
      const client = buildSupabase({
        savedRow: { ...SAVED, program_url: 'https://example.edu/cs' },
      });
      mockCreateClient.mockResolvedValue(client);

      const res = await POST(request({ universityId: 123 }));

      expect(mockCreateParseJob).toHaveBeenCalledWith(
        'application-1',
        'https://example.edu/cs',
        123,
      );
      await expect(res.json()).resolves.toMatchObject({ enrichment: 'queued' });
      expect(client.updates.some((u) => u.parse_status === 'pending')).toBe(true);
    });

    it('NEVER leaves the row pending when the queue refused it', async () => {
      // This is the bug that stranded 13 live applications since 15 June:
      // createParseJob returns null on a write failure, the old endpoint
      // swallowed it, and the row kept saying "the AI is reading the page".
      mockCreateParseJob.mockResolvedValue(null);
      const client = buildSupabase({
        savedRow: { ...SAVED, program_url: 'https://example.edu/cs' },
      });
      mockCreateClient.mockResolvedValue(client);

      const res = await POST(request({ universityId: 123 }));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ enrichment: 'unavailable' });
      expect(client.updates.some((u) => u.parse_status === 'pending')).toBe(false);
      expect(application(client)).toMatchObject({ parse_status: 'complete' });
    });

    it('survives the queue throwing, without stranding the row', async () => {
      mockCreateParseJob.mockRejectedValue(new Error('connection reset'));
      const client = buildSupabase({
        savedRow: { ...SAVED, program_url: 'https://example.edu/cs' },
      });
      mockCreateClient.mockResolvedValue(client);

      const res = await POST(request({ universityId: 123 }));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ enrichment: 'unavailable' });
      expect(client.updates.some((u) => u.parse_status === 'pending')).toBe(false);
    });
  });
});
