import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseVinUniSectionLine,
  streamDeepSeekText,
  streamVinUniEvaluation,
  streamOpenRouterText,
  VINUNI_EVALUATION_CONFIG,
  type VinUniTextStream,
} from './vinuni-grounded-evaluation';

function responseFromChunks(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

describe('VinUni provider streaming', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('streams DeepSeek content with thinking disabled and no reasoning_effort', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      responseFromChunks([
        'data: {"choices":[{"delta":{"content":"{\\"section\\":\\"A\\""},"finish_reason":null}]}\n',
        '\ndata: {"choices":[{"delta":{"content":"}\\n"},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const chunks = [];
    for await (const chunk of streamDeepSeekText(
      {
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'Evaluate' }],
        maxTokens: 2600,
        temperature: 0.2,
      },
      'deepseek-key',
    )) {
      chunks.push(chunk);
    }

    expect(chunks.map(({ content }) => content ?? '').join('')).toBe('{"section":"A"}\n');
    expect(chunks.at(-1)).toMatchObject({
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer deepseek-key' });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'deepseek-v4-pro',
      stream: true,
      stream_options: { include_usage: true },
      thinking: { type: 'disabled' },
      temperature: 0.2,
      max_tokens: 2600,
    });
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('response_format');
  });

  it('uses OpenRouter only through its explicit streaming adapter', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      responseFromChunks([
        'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const chunks = [];
    for await (const chunk of streamOpenRouterText(
      {
        model: 'qwen/qwen3.5-flash-02-23',
        messages: [{ role: 'user', content: 'Evaluate' }],
        maxTokens: 2600,
        temperature: 0.2,
      },
      'openrouter-key',
    )) {
      chunks.push(chunk);
    }

    expect(chunks[0]?.content).toBe('ok');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      stream: true,
      reasoning: { effort: 'none' },
    });
    expect(body).not.toHaveProperty('thinking');
  });
});

describe('VinUni section protocol', () => {
  const bullet = (text: string) => ({ text, evidenceIds: ['U001'] });

  it('accepts a grounded D section with exactly 3+3+3 bullets', () => {
    const line = JSON.stringify({
      section: 'D',
      criterion: 'ability',
      data: {
        score: 8,
        analysis: [bullet('Phân tích 1'), bullet('Phân tích 2'), bullet('Phân tích 3')],
        strengths: [bullet('Điểm mạnh 1'), bullet('Điểm mạnh 2'), bullet('Điểm mạnh 3')],
        gaps: [bullet('Cải thiện 1'), bullet('Cải thiện 2'), bullet('Cải thiện 3')],
      },
    });

    expect(parseVinUniSectionLine(line, new Set(['U001']))).toMatchObject({
      type: 'section',
      section: 'D',
      criterion: 'ability',
      data: { score: 8 },
    });
  });

  it('rejects evidence IDs that do not exist in the essay segments', () => {
    const line = JSON.stringify({
      section: 'A',
      data: {
        items: [
          bullet('Tổng quan 1'),
          bullet('Tổng quan 2'),
          { text: 'Tổng quan sai', evidenceIds: ['U999'] },
        ],
      },
    });

    expect(() => parseVinUniSectionLine(line, new Set(['U001']))).toThrow(
      'Unknown evidence ID: U999',
    );
  });
});

describe('VinUni one-call evaluation', () => {
  const bullet = (text: string) => ({ text, evidenceIds: ['U001'] });
  const triple = (prefix: string) => [
    bullet(`${prefix} 1`),
    bullet(`${prefix} 2`),
    bullet(`${prefix} 3`),
  ];
  const validLines = () => [
    { section: 'A', data: { items: triple('Tổng quan') } },
    {
      section: 'B',
      data: {
        strengths: [bullet('Cấu trúc rõ')],
        weaknesses: [
          {
            category: 'depth_development',
            title: 'Độ sâu và phát triển',
            items: [bullet('Cần thêm chiều sâu')],
          },
        ],
        suggestions: [bullet('Bổ sung suy ngẫm')],
      },
    },
    {
      section: 'C',
      data: {
        analysis: [bullet('Mở bài trực tiếp')],
        suggestions: [bullet('Tăng tương phản')],
      },
    },
    ...(['ability', 'aspirations', 'creativity', 'commitment'] as const).map(
      (criterion, index) => ({
        section: 'D',
        criterion,
        data: {
          score: [8, 7, 6, 9][index],
          analysis: triple(`Phân tích ${criterion}`),
          strengths: triple(`Điểm mạnh ${criterion}`),
          gaps: triple(`Cải thiện ${criterion}`),
        },
      }),
    ),
    { section: 'E', data: { items: triple('Bước tiếp theo') } },
  ];

  it('uses one model stream and computes section F in code', async () => {
    const lines = validLines()
      .map((line) => JSON.stringify(line))
      .join('\n');
    const requests: Parameters<VinUniTextStream>[0][] = [];
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      requests.push(request);
      yield { content: lines.slice(0, 127) };
      yield { content: `${lines.slice(127)}\n`, finishReason: 'stop' };
    });

    const events = [];
    for await (const event of streamVinUniEvaluation({
      essay: 'I led a robotics team and improved the workshop.',
      config: VINUNI_EVALUATION_CONFIG!,
      apiKey: 'key',
      model: 'deepseek-v4-pro',
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(provider).toHaveBeenCalledTimes(1);
    expect(requests[0]).toMatchObject({ maxTokens: 4800 });
    expect(events.filter((event) => event.type === 'section').map((event) => event.section)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'D',
      'D',
      'D',
      'E',
      'F',
    ]);
    const complete = events.at(-1);
    expect(complete).toMatchObject({
      type: 'complete',
      analysis: {
        overall: { score: 75, verdict: 'promising' },
        pillars: {
          ability: { score: 80 },
          aspirations: { score: 70 },
          creativity: { score: 60 },
          commitment: { score: 90 },
        },
      },
    });
  });

  it('repairs only missing sections with the same provider and model', async () => {
    const allLines = validLines();
    const models: string[] = [];
    const requests: Parameters<VinUniTextStream>[0][] = [];
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      models.push(request.model);
      requests.push(request);
      const invocation = provider.mock.calls.length;
      const output =
        invocation === 1
          ? allLines.slice(0, -1)
          : allLines.slice(-1);
      yield {
        content: `${output.map((line) => JSON.stringify(line)).join('\n')}\n`,
        finishReason: 'stop',
      };
    });

    const events = [];
    for await (const event of streamVinUniEvaluation({
      essay: 'I led a robotics team and improved the workshop.',
      config: VINUNI_EVALUATION_CONFIG!,
      apiKey: 'key',
      model: 'deepseek-v4-pro',
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(provider).toHaveBeenCalledTimes(2);
    expect(models).toEqual(['deepseek-v4-pro', 'deepseek-v4-pro']);
    expect(requests[1]).toMatchObject({ maxTokens: 2400 });
    expect(requests[1]?.messages[0]?.content).toContain('E');
    expect(requests[1]?.messages[0]?.content).not.toContain('Chỉ xuất đúng 8 JSON object');
    expect(events.at(-1)?.type).toBe('complete');
  });
});
