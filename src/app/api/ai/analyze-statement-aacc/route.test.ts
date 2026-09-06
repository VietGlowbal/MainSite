import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  streamVinUniEvaluationMock,
  streamVinUniEvaluationV2Mock,
  streamOpenAITextMock,
  buildVinUniEvaluationContextMock,
  fetchApplicationWorkspaceMock,
  createClientMock,
} = vi.hoisted(() => ({
  streamVinUniEvaluationMock: vi.fn(),
  streamVinUniEvaluationV2Mock: vi.fn(),
  streamOpenAITextMock: vi.fn(),
  buildVinUniEvaluationContextMock: vi.fn(),
  fetchApplicationWorkspaceMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/ai/vinuni-grounded-evaluation', () => ({
  VINUNI_EVALUATION_CONFIG: { schemaVersion: 'trial' },
  streamVinUniEvaluation: streamVinUniEvaluationMock,
  streamOpenAIText: streamOpenAITextMock,
}));

vi.mock('@/lib/ai/vinuni-evaluation-v2', () => ({
  VINUNI_EVALUATION_CONFIG_V2: {
    schemaVersion: 'v2-schema',
    rubricVersion: 'v2-rubric',
    promptVersion: 'v2-prompt',
  },
  buildVinUniEvaluationContext: buildVinUniEvaluationContextMock,
  streamVinUniEvaluationV2: streamVinUniEvaluationV2Mock,
}));

vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: fetchApplicationWorkspaceMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { POST } from './route';

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/ai/analyze-statement-aacc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationId: 'app-1',
      text: 'A'.repeat(200),
      essayPrompt: 'Describe a meaningful achievement and what you learned from it.',
      ...overrides,
    }),
  });
}

describe('POST /api/ai/analyze-statement-aacc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VINUNI_GROUNDED_PIPELINE_ENABLED', 'true');
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v1');
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('OPENAI_MODEL', '');
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
        })),
      })),
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: {
        id: 'app-1',
        universityName: 'VinUniversity',
        courseName: 'Bachelor of Computer Science',
      },
      course: {
        courseName: 'Bachelor of Computer Science',
        degreeLevel: 'Bachelor',
        subject: 'Computer Science',
      },
    });
    buildVinUniEvaluationContextMock.mockReturnValue({
      applicationId: 'app-1',
      programmeMatch: { confidence: 'high', programmeName: 'Bachelor of Computer Science' },
      profileSnapshot: null,
      profileEvidence: [],
      programmeEvidence: [],
    });
    streamVinUniEvaluationMock.mockImplementation(async function* () {
      yield { type: 'section', section: 'A', data: { items: [] } };
      yield {
        type: 'complete',
        analysis: { overall: { score: 75, verdict: 'promising', summary: 'Tổng quan' } },
        timing: { firstSectionMs: 1200, totalMs: 9200 },
      };
    });
  });

  it('streams NDJSON through the OpenAI provider by default', async () => {
    const response = await POST(request({ applicationId: '' }));
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(events.map(({ type }) => type)).toEqual(['section', 'complete']);
    expect(streamVinUniEvaluationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'openai-key',
        model: 'gpt-4o',
        stream: streamOpenAITextMock,
      }),
    );
  });

  it('uses the V2 NDJSON pipeline without production feature flags', async () => {
    vi.stubEnv('VINUNI_GROUNDED_PIPELINE_ENABLED', '');
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', '');
    streamVinUniEvaluationV2Mock.mockImplementation(async function* () {
      yield {
        type: 'complete',
        analysis: { isComplete: true },
        inputHash: 'v2-default',
        versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
        timing: { firstSectionMs: 1000, totalMs: 5000 },
      };
    });

    const response = await POST(request());
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(events.map(({ type }) => type)).toEqual(['complete']);
    expect(streamVinUniEvaluationV2Mock).toHaveBeenCalledOnce();
  });

  it('does not impose a hard timeout on long generations', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await (await POST(request({ applicationId: '' }))).text();

    expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 60_000)).toBe(false);
  });

  it('emits a stream error without retrying', async () => {
    streamVinUniEvaluationMock.mockImplementation(async function* () {
      yield { type: 'section', section: 'A', data: { items: [] } };
      throw new Error('provider unavailable');
    });

    const response = await POST(request({ applicationId: '' }));
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(events.at(-1)).toMatchObject({
      type: 'error',
      code: 'STREAM_FAILED',
      retryable: true,
    });
    expect(streamVinUniEvaluationMock).toHaveBeenCalledTimes(1);
  });

  it('validates application ownership and streams the V2 two-pass workflow', async () => {
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v2');
    streamVinUniEvaluationV2Mock.mockImplementation(async function* () {
      yield {
        type: 'status',
        stage: 'mapping_evidence',
        message: 'Đang lập bản đồ dẫn chứng…',
      };
      yield {
        type: 'complete',
        analysis: { isComplete: true },
        inputHash: 'v2-abcd',
        versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
        timing: { firstSectionMs: 1000, totalMs: 5000 },
      };
    });

    const response = await POST(
      request({ requestedSections: ['B', 'D:ability'] }),
    );
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(fetchApplicationWorkspaceMock).toHaveBeenCalledWith('app-1', 'user-1');
    expect(buildVinUniEvaluationContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        application: expect.objectContaining({ id: 'app-1' }),
        profile: null,
      }),
    );
    expect(streamVinUniEvaluationV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        essay: 'A'.repeat(200),
        essayPrompt: 'Describe a meaningful achievement and what you learned from it.',
        requestedSections: ['B', 'D:ability'],
        stream: streamOpenAITextMock,
      }),
    );
    expect(events.map(({ type }) => type)).toEqual(['status', 'complete']);
  });

  it('uses local VinUni demo context without auth or database access', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v2');
    streamVinUniEvaluationV2Mock.mockImplementation(async function* () {
      yield {
        type: 'complete',
        analysis: { isComplete: true },
        inputHash: 'v2-demo',
        versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
        timing: { firstSectionMs: 1000, totalMs: 5000 },
      };
    });

    const response = await POST(request({ applicationId: 'vinuni-demo' }));
    await response.text();

    expect(response.status).toBe(200);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(fetchApplicationWorkspaceMock).not.toHaveBeenCalled();
    expect(buildVinUniEvaluationContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        application: {
          id: 'vinuni-demo',
          universityName: 'VinUniversity',
          courseName: 'Bachelor of Computer Science',
        },
        profile: null,
      }),
    );
  });

  it('uses an authenticated applicationless V2 context for the public VinUni page', async () => {
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v1');
    streamVinUniEvaluationV2Mock.mockImplementation(async function* () {
      yield {
        type: 'complete',
        analysis: { isComplete: true },
        inputHash: 'v2-public',
        versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
        timing: { firstSectionMs: 1000, totalMs: 5000 },
      };
    });

    const response = await POST(
      request({ applicationId: '', contextMode: 'vinuni_public', essayPrompt: '' }),
    );
    await response.text();

    expect(response.status).toBe(200);
    expect(fetchApplicationWorkspaceMock).not.toHaveBeenCalled();
    expect(buildVinUniEvaluationContextMock).toHaveBeenCalledWith({
      application: { id: null, universityName: 'VinUniversity', courseName: null },
      course: null,
      profile: null,
    });
    expect(streamVinUniEvaluationV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({ essayPrompt: expect.any(String) }),
    );
  });

  it('does not expose the VinUni demo endpoint in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v2');

    const response = await POST(request({ applicationId: 'vinuni-demo' }));

    expect(response.status).toBe(404);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(streamVinUniEvaluationV2Mock).not.toHaveBeenCalled();
  });

  it('returns 404 before opening the V2 stream when the application is not owned', async () => {
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v2');
    fetchApplicationWorkspaceMock.mockResolvedValueOnce(null);

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(streamVinUniEvaluationV2Mock).not.toHaveBeenCalled();
  });

  it('rejects invalid V2 prompt and essay lengths before opening the stream', async () => {
    vi.stubEnv('VINUNI_ESSAY_PIPELINE_VERSION', 'v2');

    const shortEssay = await POST(request({ text: 'short' }));
    const longPrompt = await POST(request({ essayPrompt: 'P'.repeat(2001) }));

    expect(shortEssay.status).toBe(400);
    expect(longPrompt.status).toBe(400);
    expect(fetchApplicationWorkspaceMock).not.toHaveBeenCalled();
  });
});
