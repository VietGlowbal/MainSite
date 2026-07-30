import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  loadCvBuilderContextMock,
  generateCvTargetProfileMock,
  streamDeepSeekTextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  loadCvBuilderContextMock: vi.fn(),
  generateCvTargetProfileMock: vi.fn(),
  streamDeepSeekTextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/ai/cv-builder-context', () => ({
  isCvBuilderEnabled: () => true,
  loadCvBuilderContext: loadCvBuilderContextMock,
}));
vi.mock('@/lib/ai/cv-builder', () => ({
  generateCvTargetProfile: generateCvTargetProfileMock,
}));
vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  streamDeepSeekText: streamDeepSeekTextMock,
}));

import { POST } from './route';

describe('POST cv-builder/target-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-key');
    vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-v4-pro');
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
    generateCvTargetProfileMock.mockResolvedValue({
      universityName: 'Example University',
      programmeName: 'BSc Computer Science',
      keywords: ['Builder', 'Analytical', 'Collaborative'],
    });
  });

  it('streams status and a completed DeepSeek target profile', async () => {
    const response = await POST(
      new Request('http://localhost/api/applications/app-1/cv-builder/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerDirection: 'Software Engineering' }),
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
        apiKey: 'deepseek-key',
        model: 'deepseek-v4-pro',
        stream: streamDeepSeekTextMock,
      }),
    );
    expect(loadCvBuilderContextMock).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ id: 'user-1' }),
    );
  });
});
