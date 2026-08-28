import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAiJsonCompletion } from './openai-client';

describe('openAiJsonCompletion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the completion-token parameter required by GPT-5 models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await openAiJsonCompletion({
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      messages: [{ role: 'user', content: 'test' }],
      temperature: 0.2,
      maxTokens: 123,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(123);
    expect(body).not.toHaveProperty('max_tokens');
  });
});
