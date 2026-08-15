import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  loadCvBuilderContextMock,
  loadLatestCvStrategySnapshotMock,
  streamCvBuilderGenerationMock,
  validateTargetProfileMock,
  streamOpenAITextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  loadCvBuilderContextMock: vi.fn(),
  loadLatestCvStrategySnapshotMock: vi.fn(),
  streamCvBuilderGenerationMock: vi.fn(),
  validateTargetProfileMock: vi.fn((value) => value),
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
vi.mock('@/lib/ai/cv-builder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/cv-builder')>();
  return {
    ...actual,
    streamCvBuilderGeneration: streamCvBuilderGenerationMock,
    validateTargetProfile: validateTargetProfileMock,
  };
});
vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  streamOpenAIText: streamOpenAITextMock,
}));

import { POST } from './route';

const form = {
  personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
  education: [],
  entries: [
    {
      id: 'entry-1',
      category: 'project',
      title: 'Robotics Project',
      contributions: [
        { id: 'K001', framework: 'built', text: 'Built a robot for 12 students.' },
      ],
    },
  ],
  awards: [],
  skillGroups: [],
};

describe('POST cv-builder/generate', () => {
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
      validSourceRefs: new Set(),
    });
    loadLatestCvStrategySnapshotMock.mockResolvedValue({
      version: 1,
      recommendationId: 'rec-1',
      createdAt: '2026-08-08T00:00:00Z',
    });
    validateTargetProfileMock.mockImplementation((value) => ({
      ...value,
      strategyProvenance: {
        version: 1,
        recommendationId: 'rec-1',
        createdAt: '2026-08-08T00:00:00Z',
      },
    }));
    streamCvBuilderGenerationMock.mockImplementation(async function* () {
      yield { type: 'section', section: 'about_me', data: { text: 'About Alex.' } };
      yield {
        type: 'complete',
        generatedCv: { plainText: 'ALEX NGUYEN' },
        timing: { firstSectionMs: 10, totalMs: 20 },
      };
    });
  });

  it('streams validated generated sections through OpenAI', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRecommendationId: 'rec-1',
          targetProfile: { keywords: ['A', 'B', 'C'] },
          form,
        }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(response.status).toBe(200);
    expect(events.map(({ type }) => type)).toEqual(['section', 'complete']);
    expect(streamCvBuilderGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'openai-key',
        model: 'gpt-4o',
        stream: streamOpenAITextMock,
        strategy: expect.objectContaining({ recommendationId: 'rec-1' }),
      }),
    );
  });

  it('uses gpt-4o-mini only for clarification improvements', async () => {
    await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfile: { keywords: ['A', 'B', 'C'] },
          expectedRecommendationId: 'rec-1',
          form,
          mode: 'clarification',
        }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );

    expect(streamCvBuilderGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        clarification: true,
      }),
    );
  });

  it('returns 401 before reading application data when the user is signed out', async () => {
    createClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
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
      new Request('http://localhost/api/applications/not-owned/cv-builder/generate', {
        method: 'POST',
        body: JSON.stringify({ expectedRecommendationId: 'rec-1' }),
      }),
      { params: Promise.resolve({ id: 'not-owned' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Application not found' });
    expect(loadLatestCvStrategySnapshotMock).not.toHaveBeenCalled();
  });

  it('requires an expected strategy id before validating generation input', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        body: JSON.stringify({ form }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_REQUIRED' });
    expect(loadLatestCvStrategySnapshotMock).not.toHaveBeenCalled();
  });

  it('rejects a stale strategy before invoking the model', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRecommendationId: 'old-rec',
          targetProfile: { keywords: ['A', 'B', 'C'] },
          form,
        }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_STALE' });
    expect(streamCvBuilderGenerationMock).not.toHaveBeenCalled();
  });

  it('accepts valid target provenance and ignores forged strategy content', async () => {
    const trustedTargetProfile = {
      keywords: ['A', 'B', 'C'],
      strategyProvenance: {
        version: 1,
        recommendationId: 'rec-1',
        createdAt: '2026-08-08T00:00:00Z',
      },
    };
    validateTargetProfileMock.mockImplementationOnce((value) => value);
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRecommendationId: 'rec-1',
          targetProfile: trustedTargetProfile,
          strategy: { recommendationId: 'forged-rec', chosenDirection: 'Forged' },
          form,
        }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(200);
    expect(streamCvBuilderGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: expect.objectContaining({
          recommendationId: 'rec-1',
        }),
      }),
    );
    expect(streamCvBuilderGenerationMock.mock.calls[0]?.[0].strategy).not.toMatchObject({
      recommendationId: 'forged-rec',
      chosenDirection: 'Forged',
    });
  });

  it('returns STRATEGY_REQUIRED when latest F7 is missing', async () => {
    loadLatestCvStrategySnapshotMock.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRecommendationId: 'rec-1',
          targetProfile: { keywords: ['A', 'B', 'C'] },
          form,
        }),
      }),
      { params: Promise.resolve({ id: 'app-1' }) },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'STRATEGY_REQUIRED' });
  });
});
