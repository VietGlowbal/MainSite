import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  StructuredGenerationError,
  generateStructured,
} from './structured-generation';

const SCHEMA = z.object({
  summary: z.string().min(3),
  score: z.number().int().min(0).max(100),
});
type Output = z.infer<typeof SCHEMA>;

/** Minimal stand-in for the OpenAI chat.completions namespace. */
function fakeClient(
  impl: (callArgs: {
    messages: Array<{ role: string; content: string }>;
    signal?: AbortSignal;
  }) => Promise<{
    choices: Array<{ message: { content: string }; finish_reason: string }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>,
) {
  const create = vi.fn(impl);
  return { client: { chat: { completions: { create } } }, create };
}

function okResponse(content: string) {
  return {
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
  };
}

const BASE_ARGS = {
  moduleId: 'test-module',
  promptVersion: 'tp-v1',
  schemaVersion: 'ts-v1',
  schema: SCHEMA,
  systemPrompt: 'You are a test module. EVIDENCE-MARKER-SYSTEM',
  userPrompt: 'Produce the output. EVIDENCE-MARKER-USER',
};

describe('generateStructured', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid JSON with the supplied Zod schema', async () => {
    const { client, create } = fakeClient(async () =>
      okResponse('{"summary":"strong evidence","score":42}'),
    );

    const result = await generateStructured<Output>({ ...BASE_ARGS, client: client as never });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ summary: 'strong evidence', score: 42 });
    expect(result.meta.attemptCount).toBe(1);
    expect(result.meta.model).toBeTruthy();
    expect(result.meta.promptVersion).toBe('tp-v1');
    expect(result.meta.schemaVersion).toBe('ts-v1');
    expect(typeof result.meta.latencyMs).toBe('number');
  });

  it('gives an invalid output exactly one repair attempt, then succeeds', async () => {
    let call = 0;
    const { client, create } = fakeClient(async () => {
      call += 1;
      if (call === 1) return okResponse('{"summary":"nope"}'); // fails schema validation
      return okResponse('{"summary":"repaired answer","score":10}');
    });

    const result = await generateStructured<Output>({ ...BASE_ARGS, client: client as never });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ summary: 'repaired answer', score: 10 });
    expect(result.meta.attemptCount).toBe(2);
    // The repair request must carry the schema issue so the model can fix it.
    const repairMessages = create.mock.calls[1][0].messages as Array<{ role: string; content: string }>;
    expect(repairMessages.some((m) => /invalid/i.test(m.content))).toBe(true);
  });

  it('fails after the second invalid output without further attempts', async () => {
    const { client, create } = fakeClient(async () => okResponse('totally not json'));

    await expect(generateStructured<Output>({ ...BASE_ARGS, client: client as never })).rejects.toMatchObject({
      kind: 'json',
    });

    // One primary attempt + one repair attempt — never a third call, and no
    // partial write happens here (persistence belongs to the orchestrator).
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('classifies a schema-validation failure distinctly from a JSON failure', async () => {
    const schemaFail = fakeClient(async () => okResponse('{"summary":"short","score":9999}'));
    await expect(
      generateStructured<Output>({ ...BASE_ARGS, client: schemaFail.client as never }),
    ).rejects.toMatchObject({ kind: 'schema_validation' });

    const jsonFail = fakeClient(async () => okResponse('not-json'));
    await expect(
      generateStructured<Output>({ ...BASE_ARGS, client: jsonFail.client as never }),
    ).rejects.toMatchObject({ kind: 'json' });
  });

  it('classifies a provider failure without retrying it', async () => {
    const { client, create } = fakeClient(async () => {
      throw Object.assign(new Error('OpenAI request failed (503): upstream'), { name: 'APIError' });
    });

    await expect(generateStructured<Output>({ ...BASE_ARGS, client: client as never })).rejects.toMatchObject({
      kind: 'provider',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('aborts within its internal budget and reports a timeout', async () => {
    const { client, create } = fakeClient(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => {
            const abortError = new Error('This operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    );

    await expect(
      generateStructured<Output>({ ...BASE_ARGS, client: client as never, timeoutBudgetMs: 25 }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('returns accumulated token usage across attempts', async () => {
    let call = 0;
    const { client } = fakeClient(async () => {
      call += 1;
      if (call === 1) return okResponse('{"summary":"bad","score":9999}');
      return okResponse('{"summary":"good","score":5}');
    });

    const result = await generateStructured<Output>({ ...BASE_ARGS, client: client as never });
    expect(result.meta.usage).toEqual({
      promptTokens: 240,
      completionTokens: 160,
      totalTokens: 400,
    });
  });

  it('never writes raw prompts or candidate evidence to logs', async () => {
    const logged: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => {
        logged.push(parts.map(String).join(' '));
      });
    }

    const failing = fakeClient(async () => okResponse('EVIDENCE-MARKER-BAD-OUTPUT'));
    await expect(
      generateStructured<Output>({
        ...BASE_ARGS,
        client: failing.client as never,
      }),
    ).rejects.toBeInstanceOf(StructuredGenerationError);

    const everything = logged.join('\n');
    expect(everything).not.toContain('EVIDENCE-MARKER-SYSTEM');
    expect(everything).not.toContain('EVIDENCE-MARKER-USER');
    expect(everything).not.toContain('EVIDENCE-MARKER-BAD-OUTPUT');

    const succeeding = fakeClient(async () => okResponse('{"summary":"fine output","score":7}'));
    await generateStructured<Output>({ ...BASE_ARGS, client: succeeding.client as never });
    expect(logged.join('\n')).not.toContain('EVIDENCE-MARKER-USER');
  });
});
