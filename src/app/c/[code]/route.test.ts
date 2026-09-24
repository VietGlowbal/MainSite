import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONSENT_COOKIE, serialiseConsentCookie } from '@/shared/lib';

/**
 * The point of these tests is one rule: `/c/<code>` may not put a persistent
 * identifier on a visitor's device unless they accepted analytics. The referral
 * cookie and the visit row are separate concerns and are asserted alongside so
 * a future change cannot buy consent compliance by breaking the feature.
 */

const mocks = vi.hoisted(() => ({
  /** Callbacks handed to `after()`, run manually so the insert is observable. */
  deferred: [] as Array<() => unknown>,
  inserts: [] as Array<Record<string, unknown>>,
  /** Existing rows for this visitor id, driving the is_unique count query. */
  visitCount: 0,
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (callback: () => unknown) => {
      mocks.deferred.push(callback);
    },
  };
});

function visitsSelect() {
  const query = {
    eq: vi.fn(() => query),
    then: (resolve: (value: { count: number }) => unknown) => resolve({ count: mocks.visitCount }),
  };
  return query;
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'ambassador_links') {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({
            data: { id: 'link-1', coordinator_id: 'coord-1', is_active: true },
          })),
        };
        return query;
      }
      return {
        select: vi.fn(() => visitsSelect()),
        insert: vi.fn(async (payload: Record<string, unknown>) => {
          mocks.inserts.push(payload);
          return { error: null };
        }),
      };
    },
  }),
}));

const { GET } = await import('./route');

afterEach(() => {
  mocks.deferred.length = 0;
  mocks.inserts.length = 0;
  mocks.visitCount = 0;
  vi.restoreAllMocks();
});

/** Drives the route the way a real click does, with the given cookie header. */
async function click(cookie?: string) {
  const request = new NextRequest('https://glowbal-education.com/c/abc', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
      ...(cookie ? { cookie } : {}),
    },
  });
  const response = await GET(request, { params: Promise.resolve({ code: 'abc' }) });
  for (const callback of mocks.deferred) await callback();
  return response;
}

describe('GET /c/<code>', () => {
  it('sets no visitor id when the visitor has made no choice yet', async () => {
    const response = await click();

    expect(response.cookies.get('gb_visitor')).toBeUndefined();
    // The referral itself is what the visitor clicked, so it still works.
    expect(response.cookies.get('gb_ref')?.value).toBe('abc');
    expect(mocks.inserts[0]).toMatchObject({ visitor_id: 'anonymous-no-consent', is_unique: false });
  });

  it('sets no visitor id when the visitor rejected non-essential analytics', async () => {
    const response = await click(`${CONSENT_COOKIE}=${serialiseConsentCookie(false)}`);

    expect(response.cookies.get('gb_visitor')).toBeUndefined();
    expect(mocks.inserts[0]).toMatchObject({ visitor_id: 'anonymous-no-consent' });
  });

  it('issues a visitor id, and counts the visit as unique, once analytics is accepted', async () => {
    const response = await click(`${CONSENT_COOKIE}=${serialiseConsentCookie(true)}`);

    const visitor = response.cookies.get('gb_visitor');
    expect(visitor?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(visitor?.httpOnly).toBe(true);
    expect(visitor?.maxAge).toBe(60 * 60 * 24 * 365);
    expect(mocks.inserts[0]).toMatchObject({ visitor_id: visitor?.value, is_unique: true });
  });

  it('reuses an existing visitor id and marks the repeat visit as not unique', async () => {
    mocks.visitCount = 1;
    const response = await click(
      `${CONSENT_COOKIE}=${serialiseConsentCookie(true)}; gb_visitor=known-visitor`,
    );

    // Nothing re-issued: the cookie the browser already holds is left alone.
    expect(response.cookies.get('gb_visitor')).toBeUndefined();
    expect(mocks.inserts[0]).toMatchObject({ visitor_id: 'known-visitor', is_unique: false });
  });

  it('clears a visitor id that was issued before consent was withdrawn', async () => {
    const response = await click(
      `${CONSENT_COOKIE}=${serialiseConsentCookie(false)}; gb_visitor=known-visitor`,
    );

    const cleared = response.cookies.get('gb_visitor');
    expect(cleared?.value).toBe('');
    expect(cleared?.maxAge).toBe(0);
    expect(mocks.inserts[0]).toMatchObject({ visitor_id: 'anonymous-no-consent' });
  });
});
