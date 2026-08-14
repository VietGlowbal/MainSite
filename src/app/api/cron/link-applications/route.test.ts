import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveUniversity = vi.fn();
const update = vi.fn();
let rows: Array<{
  id: string;
  university_name: string | null;
  course_url: string | null;
  country: string | null;
}> = [];

function applicationQuery() {
  const query = {
    is: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };
  return query;
}

const from = vi.fn(() => ({
  select: vi.fn(() => applicationQuery()),
  update: (payload: Record<string, unknown>) => {
    update(payload);
    const query = {
      eq: vi.fn(() => query),
      is: vi.fn(async () => ({ error: null })),
    };
    return query;
  },
}));

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCron: () => true }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from }),
}));
vi.mock('@/features/universities/api', () => ({ resolveUniversity }));

const { GET } = await import('./route');

const BIRMINGHAM_ROW = {
  id: 'application-1',
  university_name: 'University of Birmingham',
  course_url: 'https://www.birmingham.ac.uk/study/courses/undergraduate/marketing-bsc',
  country: 'United Kingdom',
};

async function call(query = '') {
  const response = await GET(
    new NextRequest(`http://localhost/api/cron/link-applications${query}`),
  );
  return response.json();
}

beforeEach(() => {
  rows = [BIRMINGHAM_ROW];
  resolveUniversity.mockReset();
  update.mockReset();
  from.mockClear();
});

describe('link-applications reconciliation safety', () => {
  it('makes dry-run genuinely read-only and reports rows it would create', async () => {
    resolveUniversity.mockResolvedValue({
      status: 'unmatched',
      name: 'University of Birmingham',
    });

    const body = await call('?dryRun=1');

    expect(resolveUniversity).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'University of Birmingham' }),
      { createIfMissing: false },
    );
    expect(update).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
      considered: 1,
      matched: 0,
      created: 0,
      wouldCreate: 1,
      skipped: 0,
      failed: 0,
    });
    expect(body.details).toEqual([
      {
        id: 'application-1',
        name: 'University of Birmingham',
        outcome: 'would-create',
      },
    ]);
  });

  it('does not create or update unmatched rows in create=0 mode', async () => {
    resolveUniversity.mockResolvedValue({
      status: 'unmatched',
      name: 'University of Birmingham',
    });

    const body = await call('?create=0');

    expect(resolveUniversity).toHaveBeenCalledWith(expect.any(Object), {
      createIfMissing: false,
    });
    expect(update).not.toHaveBeenCalled();
    expect(body).toMatchObject({ wouldCreate: 0, skipped: 1 });
    expect(body.details[0]?.outcome).toBe('skipped:create-disabled');
  });

  it('previews an existing match without updating the application', async () => {
    resolveUniversity.mockResolvedValue({
      status: 'matched',
      universityId: 42,
      match: {
        id: 42,
        name: 'University of Birmingham',
        reason: 'domain',
        confidence: 1,
      },
    });

    const body = await call('?dryRun=1');

    expect(update).not.toHaveBeenCalled();
    expect(body).toMatchObject({ matched: 1, created: 0, wouldCreate: 0 });
    expect(body.details[0]?.outcome).toBe('would-match:domain');
  });

  it('links a matched row in the normal scheduled mode', async () => {
    resolveUniversity.mockResolvedValue({
      status: 'matched',
      universityId: 42,
      match: {
        id: 42,
        name: 'University of Birmingham',
        reason: 'domain',
        confidence: 1,
      },
    });

    const body = await call();

    expect(resolveUniversity).toHaveBeenCalledWith(expect.any(Object), {
      createIfMissing: true,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ university_id: 42, updated_at: expect.any(String) }),
    );
    expect(body).toMatchObject({ matched: 1, created: 0, wouldCreate: 0 });
    expect(body.details[0]?.outcome).toBe('matched:domain');
  });
});
