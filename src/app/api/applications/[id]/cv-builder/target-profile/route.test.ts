import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  loadCvBuilderContextMock,
  loadLatestCvStrategySnapshotMock,
  generateCvTargetProfileMock,
  streamOpenAITextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  loadCvBuilderContextMock: vi.fn(),
  loadLatestCvStrategySnapshotMock: vi.fn(),
  generateCvTargetProfileMock: vi.fn(),
  streamOpenAITextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/ai/cv-builder-context', () => ({
  isCvBuilderEnabled: () => true,
  loadCvBuilderContext: loadCvBuilderContextMock,
}));
vi.mock('@/lib/ai/cv-builder-strategy', () => ({
  loadLatestCvStrategySnapshot: loadLatestCvStrategySnapshotMock,
}));
vi.mock('@/lib/ai/cv-builder', () => ({
  generateCvTargetProfile: generateCvTargetProfileMock,
}));
vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  streamOpenAIText: streamOpenAITextMock,
}));

import { POST } from './route';

describe('POST cv-builder/target-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4o');
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
      },
    });
    loadCvBuilderContextMock.mockResolvedValue({
      universityName: 'Example University',
      programmeName: 'BSc Computer Science',
      sourceEntries: [],
      validSourceRefs: new Set(),
      confidence: 'low',
      limitations: [],
    });
    loadLatestCvStrategySnapshotMock.mockResolvedValue({
      version: 1,
      recommendationId: 'rec-1',
      createdAt: '2026-08-08T00:00:00Z',
    });
    generateCvTargetProfileMock.mockResolvedValue({
      universityName: 'Example University',
      programmeName: 'BSc Computer Science',
      keywords: ['Builder', 'Analytical', 'Collaborative'],
    });
  });

  it('streams status and a completed OpenAI target profile', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRecommendationId: 'rec-1' }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(events.map(({ type }) => type)).toEqual(['status', 'status', 'complete']);
    expect(generateCvTargetProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'openai-key',
        model: 'gpt-4o',
        stream: streamOpenAITextMock,
        strategy: expect.objectContaining({ recommendationId: 'rec-1' }),
      }),
    );
    expect(loadCvBuilderContextMock).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('requires the exact expected recommendation id and rejects legacy free text', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerDirection: 'Software Engineering' }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_REQUIRED' });
    expect(generateCvTargetProfileMock).not.toHaveBeenCalled();
  });

  it('returns 401 before reading application data when the user is signed out', async () => {
    createClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        body: JSON.stringify({ expectedRecommendationId: 'rec-1' }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(401);
    expect(loadCvBuilderContextMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an application outside the signed-in owner scope', async () => {
    loadCvBuilderContextMock.mockResolvedValueOnce(null);
    const response = await POST(
      new Request('http://localhost/api/applications/not-owned/cv-builder/target-profile', {
        method: 'POST',
        body: JSON.stringify({ expectedRecommendationId: 'rec-1' }),
      }),
      { params: Promise.resolve({ id: 'not-owned' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Application not found' });
    expect(loadLatestCvStrategySnapshotMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-owner before validating a malformed business payload', async () => {
    loadCvBuilderContextMock.mockResolvedValueOnce(null);
    const response = await POST(
      new Request('http://localhost/api/applications/not-owned/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"expectedRecommendationId":',
      }),
      { params: Promise.resolve({ id: 'not-owned' }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Application not found' });
    expect(loadLatestCvStrategySnapshotMock).not.toHaveBeenCalled();
  });

  it('rejects a stale recommendation before calling OpenAI', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRecommendationId: 'old-rec' }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_STALE' });
    expect(generateCvTargetProfileMock).not.toHaveBeenCalled();
  });

  it('blocks when no valid F7 strategy exists', async () => {
    loadLatestCvStrategySnapshotMock.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRecommendationId: 'rec-1' }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_REQUIRED' });
  });
});
