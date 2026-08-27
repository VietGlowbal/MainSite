import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two refusals are the interesting cases.
 *
 * Storing a review of an empty CV would be worse than refusing: the row would
 * carry a content version, the staleness comparison would report it as current,
 * and the student would see "reviewed, no issues" for a CV that does not exist.
 * Same reasoning for a missing target profile — the review is scored against it,
 * so without one the output would be generic CV advice wearing this feature's
 * clothes.
 */

const requireApplicationOwner = vi.fn();
const getOrCreateStrategy = vi.fn();
const getStructuredCv = vi.fn();
const getTargetProfile = vi.fn();
const insertCvReview = vi.fn();
const upsertStructuredCv = vi.fn();
const assembleStrategyContext = vi.fn();
const reviewCv = vi.fn();
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
    getStructuredCv: (...args: unknown[]) => getStructuredCv(...args),
    getTargetProfile: (...args: unknown[]) => getTargetProfile(...args),
    getLatestCvReview: () => Promise.resolve(null),
    insertCvReview: (...args: unknown[]) => insertCvReview(...args),
    upsertStructuredCv: (...args: unknown[]) => upsertStructuredCv(...args),
    assembleStrategyContext: (...args: unknown[]) => assembleStrategyContext(...args),
    strategyAdminClient: () => ({}),
  };
});

vi.mock('@/lib/ai/strategy/cv-review', () => ({
  reviewCv: (...args: unknown[]) => reviewCv(...args),
  CV_REVIEW_PROMPT_VERSION: 'cv-review-1',
}));

vi.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimit(...args),
  strategyAiLimiter: {},
}));

vi.mock('@/lib/analytics/track', () => ({
  trackApplicationEvent: (...args: unknown[]) => trackApplicationEvent(...args),
}));

const APP_ID = '11111111-1111-4111-8111-111111111111';

function params() {
  return { params: Promise.resolve({ id: APP_ID }) };
}

function ownerOk() {
  return { supabase: {}, user: { id: 'user-1' }, application: { id: APP_ID } };
}

const CV_WITH_CONTENT = {
  id: 'cv-1',
  strategyId: 'strategy-1',
  sections: [{ id: 's1', kind: 'education', entries: [{ id: 'e1', bullets: ['Studied'] }] }],
  selectedLayout: null,
  contentVersion: 5,
  lastReviewedVersion: null,
  lastExportedVersion: null,
  sourceDocumentId: null,
  updatedAt: '2026-07-01T00:00:00Z',
};

const TARGET_PROFILE = {
  id: 'tp-1',
  strategyId: 'strategy-1',
  careerDirection: 'Data engineering',
  universityPositioning: null,
  educationPhilosophy: null,
  environment: null,
  programmeObjectives: null,
  priorityCapabilities: 'Analytical thinking',
  careerAlignment: null,
  missingInformation: [],
  sourcesUsed: [],
  version: 3,
  generatedAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  requireApplicationOwner.mockResolvedValue(ownerOk());
  getOrCreateStrategy.mockResolvedValue({ id: 'strategy-1' });
  getStructuredCv.mockResolvedValue(CV_WITH_CONTENT);
  getTargetProfile.mockResolvedValue(TARGET_PROFILE);
  assembleStrategyContext.mockResolvedValue({ candidate: {}, application: {}, documents: {}, notes: [] });
  applyRateLimit.mockReturnValue(null);
  trackApplicationEvent.mockResolvedValue(undefined);
  insertCvReview.mockImplementation((_c: unknown, args: Record<string, unknown>) =>
    Promise.resolve({ id: 'review-1', ...args }),
  );
  upsertStructuredCv.mockResolvedValue(CV_WITH_CONTENT);
  reviewCv.mockResolvedValue({
    ok: true,
    model: 'gpt-4o',
    promptVersion: 'cv-review-1',
    data: {
      strengths: [
        {
          title: 'Quantitative depth',
          evidence: 'Studied',
          targetProfileArea: 'Analytical thinking',
          programmeRelevance: 'Matters here',
          strength: 'strong',
        },
      ],
      missingSignals: [
        { signal: 'No scale shown', reason: 'Because', action: 'Add numbers', targetSection: 'projects', critical: true },
      ],
      summary: 'Solid but thin on scale.',
      sourcesUsed: [],
    },
  });
});

describe('POST /api/applications/[id]/cv/review', () => {
  it('returns 401 without a session', async () => {
    requireApplicationOwner.mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());
    expect(response.status).toBe(401);
  });

  it('refuses to review an empty CV rather than storing an empty review', async () => {
    getStructuredCv.mockResolvedValue({ ...CV_WITH_CONTENT, sections: [] });

    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());

    expect(response.status).toBe(409);
    const body = (await response.json()) as { reason: string };
    expect(body.reason).toBe('missing_cv_content');
    expect(reviewCv).not.toHaveBeenCalled();
    expect(insertCvReview).not.toHaveBeenCalled();
  });

  it('treats sections with no entries as empty', async () => {
    getStructuredCv.mockResolvedValue({
      ...CV_WITH_CONTENT,
      sections: [{ id: 's1', kind: 'education', entries: [] }],
    });

    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());
    expect(response.status).toBe(409);
  });

  it('refuses without a target profile, since the review is scored against it', async () => {
    getTargetProfile.mockResolvedValue(null);

    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());

    expect(response.status).toBe(409);
    const body = (await response.json()) as { reason: string };
    expect(body.reason).toBe('missing_target_profile');
    expect(reviewCv).not.toHaveBeenCalled();
  });

  it('does not spend a rate-limit token on a request it was going to refuse', async () => {
    getStructuredCv.mockResolvedValue({ ...CV_WITH_CONTENT, sections: [] });

    const { POST } = await import('../review/route');
    await POST(new Request('http://localhost', { method: 'POST' }), params());
    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  /**
   * The version recorded must be the version READ, not "now". If the student
   * saves an edit while the model call is in flight, the review belongs to the
   * older CV and must immediately read as outdated.
   */
  it('records the CV and target profile versions it actually assessed', async () => {
    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());

    expect(response.status).toBe(200);
    const args = insertCvReview.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args.contentVersion).toBe(5);
    expect(args.targetProfileVersion).toBe(3);
    expect(args.cvId).toBe('cv-1');
  });

  it('records lastReviewedVersion on the CV', async () => {
    const { POST } = await import('../review/route');
    await POST(new Request('http://localhost', { method: 'POST' }), params());

    const args = upsertStructuredCv.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args.lastReviewedVersion).toBe(5);
    // Not a content change, so it must not bump the content version.
    expect(args.sections).toBeUndefined();
  });

  it('returns our message on a provider failure, not the provider’s', async () => {
    reviewCv.mockResolvedValue({ ok: false, reason: 'provider_failed' });

    const { POST } = await import('../review/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), params());

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('AI provider unavailable');
    expect(insertCvReview).not.toHaveBeenCalled();
  });

  it('emits started and completed, with counts but no content', async () => {
    const { POST } = await import('../review/route');
    await POST(new Request('http://localhost', { method: 'POST' }), params());

    const events = trackApplicationEvent.mock.calls.map(
      (call) => (call[0] as { eventType: string }).eventType,
    );
    expect(events).toContain('cv_review_started');
    expect(events).toContain('cv_review_completed');

    const completed = trackApplicationEvent.mock.calls.find(
      (call) => (call[0] as { eventType: string }).eventType === 'cv_review_completed',
    )?.[0] as { metadata: Record<string, unknown> };
    expect(completed.metadata.criticalCount).toBe(1);
    // No CV text, no evidence quote, no summary in analytics.
    expect(JSON.stringify(completed.metadata)).not.toContain('Solid but thin');
    expect(JSON.stringify(completed.metadata)).not.toContain('Studied');
  });
});
