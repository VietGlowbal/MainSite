import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  loadCvBuilderContextMock,
  streamCvBuilderGenerationMock,
  validateTargetProfileMock,
  streamOpenAITextMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  loadCvBuilderContextMock: vi.fn(),
  streamCvBuilderGenerationMock: vi.fn(),
  validateTargetProfileMock: vi.fn((value) => value),
  streamOpenAITextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/ai/cv-builder-context', () => ({
  isCvBuilderEnabled: () => true,
  loadCvBuilderContext: loadCvBuilderContextMock,
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
        body: JSON.stringify({ targetProfile: { keywords: ['A', 'B', 'C'] }, form }),
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
});
