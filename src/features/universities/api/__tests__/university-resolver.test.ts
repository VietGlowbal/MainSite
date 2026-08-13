import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The resolver's job is to be *careful*, so these tests are mostly about what
 * it refuses to do: never overwrite a curated match with a guess, never invent
 * a ranking, and never leave a parse broken because the directory misbehaved.
 */

type Candidate = { id: number; name: string; country?: string | null; primary_domain?: string | null };

/** Rows the fake `universities` table returns for a candidate query. */
let candidates: Candidate[] = [];
/** Set to a message to make the first (domain-aware) select fail. */
let domainColumnMissing = false;
/** Set to a message to make every select fail. */
let selectAlwaysFails = false;
/** Rows inserted during a test, in order. */
let inserted: Array<Record<string, unknown>> = [];
/** Set to make the first insert fail, exercising the degraded retry. */
let firstInsertFails = false;
/**
 * Insert attempts so far, across every `from()` call.
 *
 * Module-scoped on purpose: the resolver's retry issues a SECOND
 * `from('universities').insert(...)`, so a counter living inside `from()` would
 * reset between the two and fail them both — which is the opposite of the
 * degraded-retry path this is meant to exercise.
 */
let insertAttempts = 0;

let nextId = 100;

function fakeQuery() {
  const rows = candidates;
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder['or'] = chain;
  builder['ilike'] = chain;
  builder['eq'] = chain;
  builder['is'] = chain;
  builder['order'] = chain;
  builder['limit'] = () =>
    selectAlwaysFails
      ? Promise.resolve({ data: null, error: { message: 'boom' } })
      : Promise.resolve({ data: rows, error: null });
  // `.single()` after an insert.
  builder['single'] = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  builder['maybeSingle'] = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  builder['select'] = chain;

  return builder;
}

const mockFrom = vi.fn(() => {
  let insertPayload: Record<string, unknown> | null = null;

  const table: Record<string, unknown> = {
    select: (columns: string) => {
      if (domainColumnMissing && columns.includes('primary_domain')) {
        const failing: Record<string, unknown> = {};
        const chain = () => failing;
        failing['or'] = chain;
        failing['ilike'] = chain;
        failing['eq'] = chain;
        failing['limit'] = () =>
          Promise.resolve({ data: null, error: { message: 'column does not exist' } });
        return failing;
      }
      return fakeQuery();
    },
    insert: (payload: Record<string, unknown>) => {
      insertPayload = payload;
      insertAttempts += 1;
      const shouldFail = firstInsertFails && insertAttempts === 1;
      return {
        select: () => ({
          single: () => {
            if (shouldFail) {
              return Promise.resolve({ data: null, error: { message: 'column does not exist' } });
            }
            inserted.push(insertPayload as Record<string, unknown>);
            return Promise.resolve({ data: { id: nextId++ }, error: null });
          },
        }),
      };
    },
  };

  return table;
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

const { resolveUniversity, AUTO_PARSE_SOURCE } = await import('../university-resolver');

beforeEach(() => {
  candidates = [];
  domainColumnMissing = false;
  selectAlwaysFails = false;
  firstInsertFails = false;
  insertAttempts = 0;
  inserted = [];
  nextId = 100;
  vi.clearAllMocks();
});

describe('resolveUniversity — matching', () => {
  it('links to an existing row on a domain match', async () => {
    candidates = [
      { id: 7, name: 'University of Toronto', country: 'Canada', primary_domain: 'utoronto.ca' },
    ];

    const outcome = await resolveUniversity({
      name: 'U of T',
      courseUrl: 'https://future.utoronto.ca/courses/cmp1',
    });

    expect(outcome).toMatchObject({ status: 'matched', universityId: 7 });
    expect(inserted).toHaveLength(0);
  });

  it('still matches by name when primary_domain has not been migrated in', async () => {
    // supabase-university-domain.sql may not have been run. Losing every
    // candidate because one column is absent would silently turn matching off.
    domainColumnMissing = true;
    candidates = [{ id: 9, name: 'University of Toronto', country: 'Canada' }];

    const outcome = await resolveUniversity({
      name: 'The University of Toronto',
      courseUrl: 'https://future.utoronto.ca/x',
    });

    expect(outcome).toMatchObject({ status: 'matched', universityId: 9 });
  });
});

describe('resolveUniversity — creating', () => {
  it('reports an unmatched university without inserting in match-only mode', async () => {
    candidates = [];

    const outcome = await resolveUniversity(
      {
        name: 'University of Birmingham',
        courseUrl: 'https://www.birmingham.ac.uk/study/courses/undergraduate/marketing-bsc',
        country: 'United Kingdom',
      },
      { createIfMissing: false },
    );

    expect(outcome).toEqual({ status: 'unmatched', name: 'University of Birmingham' });
    expect(inserted).toHaveLength(0);
    expect(insertAttempts).toBe(0);
  });

  it('creates a row when the directory has nothing close', async () => {
    candidates = [];

    const outcome = await resolveUniversity({
      name: 'Hanoi University of Science and Technology',
      courseUrl: 'https://hust.edu.vn/en/admissions',
      country: 'Vietnam',
      type: 'public',
      localName: 'Đại học Bách khoa Hà Nội',
    });

    expect(outcome.status).toBe('created');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      name: 'Hanoi University of Science and Technology',
      country: 'Vietnam',
      type: 'public',
      local_name: 'Đại học Bách khoa Hà Nội',
      primary_domain: 'hust.edu.vn',
      source: AUTO_PARSE_SOURCE,
    });
  });

  it('never writes a ranking, an acceptance rate or a tuition figure', async () => {
    /*
     * The load-bearing test. computeUniversitySelectivity reads exactly these
     * columns to place a student in reach / recommend / safe, and with all of
     * them null it returns a neutral 58. A model recalling "qs_rank: 12" for a
     * university it only read the name of does not fail loudly — it quietly
     * tells someone their safety school is a reach.
     */
    await resolveUniversity({
      name: 'Somewhere New University',
      courseUrl: 'https://new.example.edu/course',
      country: 'United States',
    });

    const row = inserted[0] ?? {};
    for (const column of [
      'qs_rank',
      'the_rank',
      'accept_rate',
      'admission_difficulty',
      'tuition_usd',
      'living_cost_usd',
      'gpa_range',
      'strengths',
    ]) {
      expect(row).not.toHaveProperty(column);
    }
  });

  it('falls back to a plainer row when the provenance columns are absent', async () => {
    // `source` and `primary_domain` are both migrations. A pending migration
    // should cost us the extra columns, not the whole row.
    firstInsertFails = true;

    const outcome = await resolveUniversity({
      name: 'Somewhere New University',
      courseUrl: 'https://new.example.edu/course',
      country: 'United States',
    });

    expect(outcome.status).toBe('created');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual({ name: 'Somewhere New University', country: 'United States' });
  });

  it('records an unstated country as Unknown rather than blank', async () => {
    await resolveUniversity({ name: 'Somewhere New University', courseUrl: 'https://x.example/y' });
    expect(inserted[0]).toMatchObject({ country: 'Unknown' });
  });
});

describe('resolveUniversity — refusing', () => {
  it('does nothing without a usable name', async () => {
    expect(await resolveUniversity({ name: null })).toEqual({
      status: 'skipped',
      reason: 'no-name',
    });
    expect(await resolveUniversity({ name: '   ' })).toEqual({
      status: 'skipped',
      reason: 'no-name',
    });
    expect(inserted).toHaveLength(0);
  });

  it('gives up rather than creating a duplicate when the lookup itself failed', async () => {
    // A failed query is not evidence that the university is absent. Creating on
    // a database error is how a directory fills with duplicates.
    selectAlwaysFails = true;

    const outcome = await resolveUniversity({
      name: 'University of Toronto',
      courseUrl: 'https://utoronto.ca/x',
    });

    expect(outcome).toEqual({ status: 'skipped', reason: 'lookup-failed' });
    expect(inserted).toHaveLength(0);
  });
});
