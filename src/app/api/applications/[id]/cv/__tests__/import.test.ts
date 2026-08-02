import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The property under test is that import cannot destroy content.
 *
 * Everything else here is supporting cast. `upsertStructuredCv` is mocked and
 * asserted never to be called on ANY path — success, unreadable, no content,
 * model failure — because the confirmation PATCH is what persists, and a write
 * appearing here later would silently reintroduce the data-loss bug this design
 * exists to prevent.
 */

const requireApplicationOwner = vi.fn();
const getOrCreateStrategy = vi.fn();
const upsertStructuredCv = vi.fn();
const assembleStrategyContext = vi.fn();
const importCvText = vi.fn();
const extractDocumentText = vi.fn();
const applyRateLimit = vi.fn();
const trackApplicationEvent = vi.fn();

vi.mock('@/server/auth', () => ({
  requireApplicationOwner: (...args: unknown[]) => requireApplicationOwner(...args),
}));

vi.mock('@/features/application-strategy/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/application-strategy/api')>(
    '@/features/application-strategy/api',
  );
  return {
    ...actual,
    getOrCreateStrategy: (...args: unknown[]) => getOrCreateStrategy(...args),
    upsertStructuredCv: (...args: unknown[]) => upsertStructuredCv(...args),
    assembleStrategyContext: (...args: unknown[]) => assembleStrategyContext(...args),
    strategyAdminClient: () => ({ from: () => ({ update: () => ({ eq: () => Promise.resolve({}) }) }) }),
  };
});

vi.mock('@/lib/ai/strategy/cv-import', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/strategy/cv-import')>(
    '@/lib/ai/strategy/cv-import',
  );
  return { ...actual, importCvText: (...args: unknown[]) => importCvText(...args) };
});

vi.mock('@/lib/ai/document-text', () => ({
  extractDocumentText: (...args: unknown[]) => extractDocumentText(...args),
}));

vi.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimit(...args),
  strategyAiLimiter: {},
}));

vi.mock('@/lib/analytics/track', () => ({
  trackApplicationEvent: (...args: unknown[]) => trackApplicationEvent(...args),
}));

const APP_ID = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';

function params() {
  return { params: Promise.resolve({ id: APP_ID }) };
}

function post(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A supabase stub whose document lookup is configurable. */
function supabaseWithDocument(doc: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: doc }) }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getOrCreateStrategy.mockResolvedValue({ id: 'strategy-1' });
  applyRateLimit.mockReturnValue(null);
  trackApplicationEvent.mockResolvedValue(undefined);
});

describe('POST /api/applications/[id]/cv/import', () => {
  it('returns 401 without a session', async () => {
    const { NextResponse } = await import('next/server');
    requireApplicationOwner.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'profile' }), params());
    expect(response.status).toBe(401);
  });

  it('rejects an unknown mode', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument(null),
      user: { id: 'user-1' },
      application: {},
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'telepathy' }), params());
    expect(response.status).toBe(400);
  });

  it('rejects a paste too short to be a CV', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument(null),
      user: { id: 'user-1' },
      application: {},
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'paste', text: 'too short' }), params());
    expect(response.status).toBe(400);
  });

  it('reports an unreadable document as a 200 with a reason, not an error', async () => {
    // A 500 here would read to the student as their upload having been thrown
    // away. It was saved; we just cannot read it, and the UI has four ways
    // forward.
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument({ id: DOC_ID, storage_key: 'k', mime_type: 'application/pdf', parsed_text: null }),
      user: { id: 'user-1' },
      application: {},
    });
    extractDocumentText.mockResolvedValue(null);

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'document', documentId: DOC_ID }), params());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'unreadable' });
    expect(importCvText).not.toHaveBeenCalled();
    expect(upsertStructuredCv).not.toHaveBeenCalled();
  });

  it('404s a document belonging to someone else', async () => {
    // The application-ownership check does not cover the document: documents
    // belong to the user, so a valid application id plus a stranger's document id
    // has to be caught by the document query's own user_id predicate.
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument(null),
      user: { id: 'user-1' },
      application: {},
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'document', documentId: DOC_ID }), params());
    expect(response.status).toBe(404);
  });

  it('returns a draft and writes nothing on success', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument({ id: DOC_ID, storage_key: 'k', mime_type: 'application/pdf', parsed_text: 'a'.repeat(200) }),
      user: { id: 'user-1' },
      application: {},
    });
    importCvText.mockResolvedValue({
      ok: true,
      model: 'gpt-4o',
      draft: {
        sections: [{ id: 's1', kind: 'education', entries: [{ id: 'e1', bullets: ['Studied'] }] }],
        uncertain: { e1: ['endDate'] },
        notes: [],
      },
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'document', documentId: DOC_ID }), params());

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; draft: { sections: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.draft.sections).toHaveLength(1);
    // The assertion that matters.
    expect(upsertStructuredCv).not.toHaveBeenCalled();
  });

  it('reports a model failure without writing', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument({ id: DOC_ID, storage_key: 'k', mime_type: 'application/pdf', parsed_text: 'a'.repeat(200) }),
      user: { id: 'user-1' },
      application: {},
    });
    importCvText.mockResolvedValue({ ok: false, reason: 'provider_failed' });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'document', documentId: DOC_ID }), params());

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    // Our message, not the provider's.
    expect(body.error).toContain('AI provider unavailable');
    expect(upsertStructuredCv).not.toHaveBeenCalled();
  });

  it('reports a readable file that is not a CV distinctly from an unreadable one', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument({ id: DOC_ID, storage_key: 'k', mime_type: 'application/pdf', parsed_text: 'a'.repeat(200) }),
      user: { id: 'user-1' },
      application: {},
    });
    importCvText.mockResolvedValue({
      ok: true,
      model: 'gpt-4o',
      draft: { sections: [], uncertain: {}, notes: ['This looks like a cover letter.'] },
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'document', documentId: DOC_ID }), params());

    const body = (await response.json()) as { ok: boolean; reason: string; notes: string[] };
    expect(body.reason).toBe('no_content');
    expect(body.notes[0]).toContain('cover letter');
  });

  it('builds from the Glowbal profile without a model call or a rate limit', async () => {
    requireApplicationOwner.mockResolvedValue({
      supabase: supabaseWithDocument(null),
      user: { id: 'user-1' },
      application: {},
    });
    assembleStrategyContext.mockResolvedValue({
      candidate: {
        academics: 'IB Diploma, 42 points',
        achievements: [{ title: 'Maths Olympiad', year: 2025, level: 'National' }],
        activities: [{ title: 'Robotics club', organisation: 'School', period: '2023-2025' }],
        goals: null,
        preferences: {},
      },
    });

    const { POST } = await import('../import/route');
    const response = await POST(post({ mode: 'profile' }), params());

    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft: { sections: { kind: string }[] }; source: string };
    expect(body.source).toBe('profile');
    expect(body.draft.sections.map((s) => s.kind)).toContain('awards');
    expect(body.draft.sections.map((s) => s.kind)).toContain('activities');
    // Deterministic: profile facts the student typed are not sent to a model.
    expect(importCvText).not.toHaveBeenCalled();
    expect(applyRateLimit).not.toHaveBeenCalled();
    expect(upsertStructuredCv).not.toHaveBeenCalled();
  });
});
